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

function alignTokens(text: string, tokenTexts: string[]): ReaderToken[] {
	const tokens: ReaderToken[] = [];
	let cursor = 0;
	for (const tokenText of tokenTexts) {
		const start = text.indexOf(tokenText, cursor);
		if (start < 0) {
			continue;
		}
		const end = start + tokenText.length;
		tokens.push({ text: tokenText, start, end });
		cursor = end;
	}
	return tokens;
}

async function tokenizeBlock(block: ReaderContentBlock): Promise<ReaderToken[]> {
	const tokenTexts = await invoke<string[]>(NATIVE_COMMANDS.READER.TOKENIZE_TEXT, {
		text: block.text,
	});
	return alignTokens(block.text, tokenTexts);
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
		total_progression: documentText.length ? page.start / documentText.length : 0,
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
	if (!activeDocument || !pages[pageIndex]) {
		return;
	}
	const locator = createLocator(pages[pageIndex]);
	try {
		activeDocument = await readerDocumentsStore.updateProgress(activeDocument._id, locator);
		telemetry.trackEvent('reader.position_saved', {}).catch(() => {});
	} catch (error) {
		handleError('There was an error saving reader progress.', error);
	}
}

async function openDocument(document: ReaderDocument): Promise<void> {
	activeDocument = document;
	tokenMap = {};
	pages = createReaderPages(document, pageLayout);
	pageIndex = getPageIndexForLocator(document, pages);
	lastPageTurnDirection = undefined;
	closeDictionary();
	telemetry
		.trackEvent('reader.document_opened', {
			source_type: document.source_type,
		})
		.catch(() => {});
	await preparePageTokens();
}

async function importDocument(): Promise<void> {
	importing = true;
	try {
		const importPayload = await invoke<ReaderImportPayload | null>(
			NATIVE_COMMANDS.READER.IMPORT_DOCUMENT
		);
		if (!importPayload) {
			return;
		}
		const document = await readerDocumentsStore.importDocument(importPayload);
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

	const confirmed = await ask(
		`Remove ${documents.length} document${documents.length === 1 ? '' : 's'} from your reading library?`,
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

	if (!missingBlocks.length) {
		return;
	}

	const entries = await Promise.all(
		missingBlocks.map(async (block) => [block.id, await tokenizeBlock(block)] as const)
	);
	tokenMap = {
		...tokenMap,
		...Object.fromEntries(entries),
	};
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

function getBlockSegments(block: ReaderPageBlock): ReaderSegment[] {
	const blockTokens = tokenMap[block.sourceBlockId] ?? [];
	return createReaderSegments(block, blockTokens);
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
	refresh: readerDocumentsStore.refresh,
	importDocument,
	openDocument,
	deleteDocument,
	deleteDocuments,
	nextPage,
	previousPage,
	goToPage,
	getPage,
	setPageLayout,
	getBlockSegments,
	openDictionary,
	selectDictionaryResult,
	closeDictionary,
	backToLibrary,
};
