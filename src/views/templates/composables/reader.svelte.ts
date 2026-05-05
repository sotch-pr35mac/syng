import { invoke } from '@tauri-apps/api/core';
import { ask } from '@tauri-apps/plugin-dialog';
import { readerDocumentsStore } from '@/stores/readerDocuments.svelte.js';
import { NATIVE_COMMANDS } from '@/types/nativeCommands.js';
import type {
	ReaderContentBlock,
	ReaderDocument,
	ReaderImportPayload,
	ReaderLocator,
	ReaderToken,
} from '@/types/reader.js';
import type { SearchEntry } from '@/types/search.js';
import { handleError, telemetry } from '@/utils';
import { applyReaderImportMetadata } from '@/utils/readerDocumentMetadata.js';
import {
	ensureReaderDocumentForRendering,
	getTableExtension,
	isTableBlock,
	tableCellTokenKey,
} from '@/utils/readerDocumentCanonical.js';
import { pickReaderImportFile } from '@/utils/readerFileImport.js';
import { invokePrepareReaderImport } from '@/utils/readerNativeImport.js';
import {
	createReaderPages,
	createReaderSegments,
	findPageIndexForPosition,
	type ReaderPage,
	type ReaderPageBlock,
	type ReaderPageLayout,
	type ReaderSegment,
} from '@/utils/readerPagination.js';

const TEXT_CONTEXT_LENGTH = 32;
const DELETE_CONFIRMATION_NAME_LIMIT = 5;

let activeDocument = $state<ReaderDocument | undefined>(undefined);
let pageIndex = $state(0);
let pages = $state<ReaderPage[]>([]);
let pageLayout = $state<ReaderPageLayout | undefined>(undefined);
let importing = $state(false);
let tokenMap = $state<Record<string, ReaderToken[]>>({});
let dictionaryResults = $state<SearchEntry[]>([]);
let dictionaryResultIndex = $state(0);
let dictionaryWord = $state<SearchEntry | undefined>(undefined);
let dictionaryToken = $state<ReaderToken | undefined>(undefined);
let dictionaryAnchor = $state<DOMRect | undefined>(undefined);
let lastPageTurnDirection = $state<'next' | 'previous' | undefined>(undefined);

function participatesInLinearText(block: ReaderContentBlock): boolean {
	return block.participates_in_linear_text !== false;
}

type NativeReaderToken = Pick<ReaderToken, 'text' | 'start' | 'end'>;

function alignTokens(
	text: string,
	tokenTexts: Array<string | NativeReaderToken>,
	blockId: string
): ReaderToken[] {
	const tokens: ReaderToken[] = [];
	let cursor = 0;
	for (const nativeToken of tokenTexts) {
		if (typeof nativeToken !== 'string') {
			tokens.push({ ...nativeToken, block_id: blockId });
			continue;
		}
		const tokenText = nativeToken;
		const start = text.indexOf(tokenText, cursor);
		if (start < 0) {
			continue;
		}
		const end = start + tokenText.length;
		tokens.push({ text: tokenText, start, end, block_id: blockId });
		cursor = end;
	}
	return tokens;
}

async function tokenizeBlock(block: ReaderContentBlock): Promise<ReaderToken[]> {
	if (!participatesInLinearText(block)) {
		return [];
	}
	const tokenTexts = await invoke<Array<string | NativeReaderToken>>(
		NATIVE_COMMANDS.READER.TOKENIZE_TEXT,
		{
			text: block.text,
		}
	);
	return alignTokens(block.text, tokenTexts, block.id);
}

async function tokenizeTableCell(
	blockId: string,
	row: number,
	col: number,
	text: string
): Promise<ReaderToken[]> {
	const tokenTexts = await invoke<Array<string | NativeReaderToken>>(
		NATIVE_COMMANDS.READER.TOKENIZE_TEXT,
		{
			text,
		}
	);
	const base = alignTokens(text, tokenTexts, blockId);
	return base.map((token) => ({
		...token,
		table_cell: { row, col },
	}));
}

function createLocator(page: ReaderPage): ReaderLocator {
	const documentText = activeDocument?.text ?? '';
	const exact = documentText.slice(
		page.start,
		Math.min(page.end, page.start + TEXT_CONTEXT_LENGTH)
	);
	const prefix = documentText.slice(Math.max(0, page.start - TEXT_CONTEXT_LENGTH), page.start);
	const suffix = documentText.slice(
		Math.min(documentText.length, page.start + exact.length),
		Math.min(documentText.length, page.start + exact.length + TEXT_CONTEXT_LENGTH)
	);
	const now = new Date().toISOString();
	return {
		resource_href: 'text',
		position: page.start,
		total_progression: documentText.length ? Math.min(1, page.start / documentText.length) : 0,
		page_index: page.index,
		text_position: {
			start: page.start,
			end: Math.min(page.end, page.start + exact.length),
		},
		text_quote: {
			exact,
			prefix,
			suffix,
		},
		updated_at: now,
	};
}

function getPageIndexForLocator(document: ReaderDocument, documentPages: ReaderPage[]): number {
	const position = document.progress?.position ?? 0;
	return findPageIndexForPosition(documentPages, position);
}

async function saveCurrentProgress(): Promise<void> {
	const document = activeDocument;
	const page = pages[pageIndex];
	if (!document || !page) {
		return;
	}
	const locator = createLocator(page);
	try {
		const updatedDocument = await readerDocumentsStore.updateProgress(document._id, locator);
		if (activeDocument?._id === document._id) {
			activeDocument = updatedDocument;
		}
		telemetry.trackEvent('reader.position_saved', {}).catch(() => {});
	} catch (error) {
		handleError('There was an error saving reader progress.', error);
	}
}

async function openDocument(document: ReaderDocument): Promise<void> {
	activeDocument = ensureReaderDocumentForRendering(document);
	tokenMap = {};
	lastPageTurnDirection = undefined;
	closeDictionary();
	pages = createReaderPages(activeDocument, pageLayout);
	pageIndex = getPageIndexForLocator(activeDocument, pages);
	await preparePageTokens();
	telemetry
		.trackEvent('reader.document_opened', {
			source_type: activeDocument.source_type,
		})
		.catch(() => {});
}

async function pickImportDocument(): Promise<ReaderImportPayload | undefined> {
	importing = true;
	try {
		return await pickReaderImportFile();
	} catch (error) {
		handleError('There was an error importing the reader document.', error);
		return undefined;
	} finally {
		importing = false;
	}
}

async function importReaderPayload(
	importPayload: ReaderImportPayload,
	title: string,
	color: string
): Promise<void> {
	importing = true;
	try {
		const document = await readerDocumentsStore.importDocument(
			applyReaderImportMetadata(importPayload, title, color)
		);
		telemetry
			.trackEvent('reader.document_imported', {
				source_type: document.source_type,
				text_length_bucket: Math.ceil(document.text.length / 1000) * 1000,
			})
			.catch(() => {});
		await openDocument(document);
	} catch (error) {
		handleError('There was an error importing the reader document.', error);
	} finally {
		importing = false;
	}
}

async function importPlainTextDocument(title: string, text: string, color: string): Promise<void> {
	try {
		const importPayload = await invokePrepareReaderImport({
			text,
			title,
			fileName: 'clipboard.txt',
			mimeType: 'text/plain',
		});
		await importReaderPayload(importPayload, title || importPayload.title, color);
	} catch (error) {
		handleError('There was an error importing the reader document.', error);
	}
}

async function importWebpageDocument(
	title: string,
	url: string,
	color: string,
	preparedPayload?: ReaderImportPayload
): Promise<void> {
	try {
		const importPayload =
			preparedPayload ??
			(await invokePrepareReaderImport({
				url,
				title,
			}));
		await importReaderPayload(importPayload, title || importPayload.title, color);
	} catch (error) {
		handleError('There was an error importing the webpage.', error);
	}
}

async function updateDocumentMetadata(
	document: ReaderDocument,
	title: string,
	color: string
): Promise<void> {
	try {
		const updatedDocument = await readerDocumentsStore.updateMetadata(document._id, {
			title,
			color,
		});
		if (activeDocument?._id === updatedDocument._id) {
			activeDocument = updatedDocument;
		}
		telemetry
			.trackEvent('reader.document_metadata_updated', {
				source_type: updatedDocument.source_type,
			})
			.catch(() => {});
	} catch (error) {
		handleError('There was an error saving reader document details.', error);
	}
}

async function deleteDocument(document: ReaderDocument): Promise<boolean> {
	const confirmed = await ask(`Remove ${document.title} from your reading library?`, {
		title: 'Remove Document',
	});
	if (!confirmed) {
		return false;
	}

	try {
		await readerDocumentsStore.deleteDocument(document._id);
		if (activeDocument?._id === document._id) {
			activeDocument = undefined;
			pageIndex = 0;
			pages = [];
			lastPageTurnDirection = undefined;
			closeDictionary();
		}
		telemetry
			.trackEvent('reader.document_removed', {
				source_type: document.source_type,
			})
			.catch(() => {});
		return true;
	} catch (error) {
		handleError('There was an error removing the reader document.', error);
		return false;
	}
}

async function deleteDocuments(documents: ReaderDocument[]): Promise<boolean> {
	if (!documents.length) {
		return false;
	}

	const documentNames = documents
		.slice(0, DELETE_CONFIRMATION_NAME_LIMIT)
		.map((document) => `- ${document.title}`)
		.join('\n');
	const remainingCount = Math.max(0, documents.length - DELETE_CONFIRMATION_NAME_LIMIT);
	const remainingText = remainingCount ? `\n- and ${remainingCount} more` : '';
	const confirmed = await ask(
		`Remove ${documents.length} document${documents.length === 1 ? '' : 's'} from your reading library?\n\n${documentNames}${remainingText}`,
		{
			title: 'Remove Documents',
		}
	);
	if (!confirmed) {
		return false;
	}

	try {
		await Promise.all(
			documents.map((document) => readerDocumentsStore.deleteDocument(document._id))
		);
		if (activeDocument && documents.some((document) => document._id === activeDocument?._id)) {
			activeDocument = undefined;
			pageIndex = 0;
			pages = [];
			lastPageTurnDirection = undefined;
			closeDictionary();
		}
		telemetry
			.trackEvent('reader.documents_removed', {
				count: documents.length,
			})
			.catch(() => {});
		return true;
	} catch (error) {
		handleError('There was an error removing reader documents.', error);
		return false;
	}
}

async function preparePageTokens(): Promise<void> {
	const page = pages[pageIndex];
	if (!page || !activeDocument) {
		return;
	}

	const sourceBlocksById = new Map(
		activeDocument.blocks.map((block) => [block.id, block] as const)
	);
	const missingBlockIds = Array.from(
		new Set(
			page.blocks.map((block) => block.sourceBlockId).filter((blockId) => !tokenMap[blockId])
		)
	);
	const missingBlocks = missingBlockIds
		.map((blockId) => sourceBlocksById.get(blockId))
		.filter((block): block is ReaderContentBlock => Boolean(block));

	const cellEntries: Array<readonly [string, ReaderToken[]]> = [];
	for (const block of missingBlocks) {
		if (!isTableBlock(block)) {
			continue;
		}
		const table = getTableExtension(block);
		if (!table) {
			continue;
		}
		for (let rowIndex = 0; rowIndex < table.rows.length; rowIndex += 1) {
			const row = table.rows[rowIndex]!;
			for (let colIndex = 0; colIndex < row.cells.length; colIndex += 1) {
				const key = tableCellTokenKey(block.id, rowIndex, colIndex);
				if (tokenMap[key]) {
					continue;
				}
				const cellText = row.cells[colIndex]!.text;
				cellEntries.push([
					key,
					await tokenizeTableCell(block.id, rowIndex, colIndex, cellText),
				]);
			}
		}
	}

	const flowEntries = await Promise.all(
		missingBlocks
			.filter((block) => participatesInLinearText(block))
			.map(async (block) => [block.id, await tokenizeBlock(block)] as const)
	);

	const nextTokenMap = {
		...tokenMap,
		...Object.fromEntries(flowEntries),
		...Object.fromEntries(cellEntries),
	};
	tokenMap = nextTokenMap;
}

async function goToPage(nextPageIndex: number): Promise<void> {
	if (!activeDocument || !pages[nextPageIndex]) {
		return;
	}
	const direction = nextPageIndex > pageIndex ? 'next' : 'previous';
	lastPageTurnDirection = direction;
	pageIndex = nextPageIndex;
	closeDictionary();
	await preparePageTokens();
	await saveCurrentProgress();
	telemetry
		.trackEvent('reader.page_changed', {
			direction,
		})
		.catch(() => {});
}

function nextPage(): Promise<void> {
	return goToPage(pageIndex + 1);
}

function previousPage(): Promise<void> {
	return goToPage(pageIndex - 1);
}

async function setPageLayout(layout: ReaderPageLayout): Promise<void> {
	const normalizedLayout = {
		...layout,
		contentWidth: Math.round(layout.contentWidth),
		contentHeight: Math.round(layout.contentHeight),
		fontSize: Math.round(layout.fontSize * 100) / 100,
		lineHeight: Math.round(layout.lineHeight * 100) / 100,
		blockGap: Math.round(layout.blockGap * 100) / 100,
		headingLineHeight: Math.round(layout.headingLineHeight * 100) / 100,
		headingGap: Math.round(layout.headingGap * 100) / 100,
		averageCharacterWidth: layout.averageCharacterWidth
			? Math.round(layout.averageCharacterWidth * 100) / 100
			: undefined,
	};

	if (pageLayout && JSON.stringify(pageLayout) === JSON.stringify(normalizedLayout)) {
		return;
	}

	const currentPosition = pages[pageIndex]?.start ?? activeDocument?.progress?.position ?? 0;
	pageLayout = normalizedLayout;

	if (!activeDocument) {
		return;
	}

	pages = createReaderPages(activeDocument, pageLayout);
	pageIndex = findPageIndexForPosition(pages, currentPosition);
	closeDictionary();
	await preparePageTokens();
}

function getPage(pageNumber: number): ReaderPage | undefined {
	return pages[pageNumber];
}

function buildTableSegments(tableBlock: ReaderContentBlock): ReaderSegment[] {
	const table = getTableExtension(tableBlock);
	if (!table) {
		return [{ type: 'text', text: tableBlock.text || '\u00a0' }];
	}
	const segments: ReaderSegment[] = [];
	for (let rowIndex = 0; rowIndex < table.rows.length; rowIndex += 1) {
		const row = table.rows[rowIndex]!;
		for (let colIndex = 0; colIndex < row.cells.length; colIndex += 1) {
			const cell = row.cells[colIndex]!;
			const key = tableCellTokenKey(tableBlock.id, rowIndex, colIndex);
			const cellTokens = tokenMap[key] ?? [];
			const syntheticBlock: ReaderPageBlock = {
				id: key,
				sourceBlockId: tableBlock.id,
				kind: 'paragraph',
				text: cell.text,
				sourceText: cell.text,
				sourceStart: 0,
				sourceEnd: cell.text.length,
				start_offset: 0,
				end_offset: cell.text.length,
				layout_mode: 'flow',
			};
			segments.push(...createReaderSegments(syntheticBlock, cellTokens));
			if (colIndex < row.cells.length - 1) {
				segments.push({ type: 'text', text: '\t' });
			}
		}
		if (rowIndex < table.rows.length - 1) {
			segments.push({ type: 'text', text: '\n' });
		}
	}
	return segments.length ? segments : [{ type: 'text', text: tableBlock.text || '\u00a0' }];
}

function getBlockSegments(pageBlock: ReaderPageBlock): ReaderSegment[] {
	if (!activeDocument) {
		return createReaderSegments(pageBlock, []);
	}
	if (pageBlock.layout_mode === 'atomic' && pageBlock.kind === 'table') {
		const source = activeDocument.blocks.find((block) => block.id === pageBlock.sourceBlockId);
		if (source && isTableBlock(source)) {
			return buildTableSegments(source);
		}
	}
	return createReaderSegments(pageBlock, tokenMap[pageBlock.sourceBlockId] ?? []);
}

function getTableCellSegments(
	tableBlockId: string,
	rowIndex: number,
	colIndex: number,
	cellText: string
): ReaderSegment[] {
	const key = tableCellTokenKey(tableBlockId, rowIndex, colIndex);
	const syntheticBlock: ReaderPageBlock = {
		id: key,
		sourceBlockId: tableBlockId,
		kind: 'paragraph',
		text: cellText,
		sourceText: cellText,
		sourceStart: 0,
		sourceEnd: cellText.length,
		start_offset: 0,
		end_offset: cellText.length,
		layout_mode: 'flow',
	};
	return createReaderSegments(syntheticBlock, tokenMap[key] ?? []);
}

async function openDictionary(token: ReaderToken, anchor?: DOMRect): Promise<void> {
	try {
		const results = await invoke<SearchEntry[]>(NATIVE_COMMANDS.DICTIONARY.QUERY_BY_CHINESE, {
			text: token.text,
		});
		const exactMatchIndex = results.findIndex(
			(result) => result.simplified === token.text || result.traditional === token.text
		);
		dictionaryResults = results;
		dictionaryResultIndex = exactMatchIndex >= 0 ? exactMatchIndex : 0;
		dictionaryWord = dictionaryResults[dictionaryResultIndex];
		dictionaryToken = token;
		dictionaryAnchor = anchor;
		telemetry.trackEvent('reader.dictionary_opened', {}).catch(() => {});
	} catch (error) {
		handleError('There was an error opening the dictionary popover.', error);
	}
}

function selectDictionaryResult(index: number): void {
	if (!dictionaryResults[index]) {
		return;
	}
	dictionaryResultIndex = index;
	dictionaryWord = dictionaryResults[index];
}

function closeDictionary(): void {
	dictionaryResults = [];
	dictionaryResultIndex = 0;
	dictionaryWord = undefined;
	dictionaryToken = undefined;
	dictionaryAnchor = undefined;
}

function backToLibrary(): void {
	saveCurrentProgress().catch(() => {});
	activeDocument = undefined;
	pageIndex = 0;
	pages = [];
	lastPageTurnDirection = undefined;
	closeDictionary();
}

async function openDocumentById(documentId: string): Promise<void> {
	const document = readerDocumentsStore.documents.find((candidate) => candidate._id === documentId);
	if (document) {
		await openDocument(document);
		return;
	}
	const loadedDocument = await readerDocumentsStore.getDocument(documentId);
	if (loadedDocument) {
		await openDocument(loadedDocument);
		return;
	}
	backToLibrary();
}

function tokensMatchDictionarySelection(
	token: ReaderToken | undefined,
	selected: ReaderToken | undefined
): boolean {
	if (!token || !selected) {
		return false;
	}
	if (
		token.text !== selected.text ||
		token.start !== selected.start ||
		token.end !== selected.end
	) {
		return false;
	}
	if (token.block_id !== selected.block_id) {
		return false;
	}
	const tokenCell = token.table_cell;
	const selectedCell = selected.table_cell;
	if (Boolean(tokenCell) !== Boolean(selectedCell)) {
		return false;
	}
	if (tokenCell && selectedCell) {
		return tokenCell.row === selectedCell.row && tokenCell.col === selectedCell.col;
	}
	return true;
}

export const readerRoute = {
	get documents(): ReaderDocument[] {
		return readerDocumentsStore.documents;
	},
	get activeDocument(): ReaderDocument | undefined {
		return activeDocument;
	},
	get currentPage(): ReaderPage | undefined {
		return pages[pageIndex];
	},
	get previousPagePreview(): ReaderPage | undefined {
		return pages[pageIndex - 1];
	},
	get nextPagePreview(): ReaderPage | undefined {
		return pages[pageIndex + 1];
	},
	get pageIndex(): number {
		return pageIndex;
	},
	get pageCount(): number {
		return pages.length;
	},
	get importing(): boolean {
		return importing;
	},
	get canGoPrevious(): boolean {
		return pageIndex > 0;
	},
	get canGoNext(): boolean {
		return pageIndex < pages.length - 1;
	},
	get dictionaryWord(): SearchEntry | undefined {
		return dictionaryWord;
	},
	get dictionaryResults(): SearchEntry[] {
		return dictionaryResults;
	},
	get dictionaryResultIndex(): number {
		return dictionaryResultIndex;
	},
	get dictionaryToken(): ReaderToken | undefined {
		return dictionaryToken;
	},
	get dictionaryAnchor(): DOMRect | undefined {
		return dictionaryAnchor;
	},
	get lastPageTurnDirection(): 'next' | 'previous' | undefined {
		return lastPageTurnDirection;
	},
	tokensMatchDictionarySelection,
	refresh: readerDocumentsStore.refresh,
	pickImportDocument,
	importReaderPayload,
	importPlainTextDocument,
	importWebpageDocument,
	updateDocumentMetadata,
	openDocument,
	openDocumentById,
	deleteDocument,
	deleteDocuments,
	nextPage,
	previousPage,
	goToPage,
	getPage,
	setPageLayout,
	getBlockSegments,
	getTableCellSegments,
	openDictionary,
	selectDictionaryResult,
	closeDictionary,
	backToLibrary,
};
