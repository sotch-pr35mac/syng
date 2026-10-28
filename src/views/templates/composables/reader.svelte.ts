import { readerSettingsStore } from '@/stores/readerSettings.svelte.js';
import {
	layoutReaderText,
	resolveReaderTextIndent,
	type ReaderTextMetrics,
} from '@/utils/readerTextLayout.js';
import { invoke } from '@tauri-apps/api/core';
import { ask } from '@tauri-apps/plugin-dialog';
import { readerDocumentsStore } from '@/stores/readerDocuments.svelte.js';
import { readerDocumentRouteStore } from '@/stores/readerRoute.svelte.js';
import { NATIVE_COMMANDS } from '@/types/nativeCommands.js';
import type {
	ReaderContentBlock,
	ReaderDocument,
	ReaderImportPayload,
	ReaderImportResult,
	ReaderLocator,
	ReaderToken,
} from '@/types/reader.js';
import type { SearchEntry } from '@/types/search.js';
import {
	normalizeDictionaryLookupRequest,
	type DictionaryLookupRequest,
} from '@/composables/dictionaryPopover.svelte.js';
import { handleError, telemetry } from '@/utils';
import { networkStatus } from '@/utils/networkStatus.svelte.js';
import {
	applyReaderImportMetadata,
	alignReaderTokens,
	ensureReaderDocumentForRendering,
	getTableExtension,
	invokeImportReaderDocument,
	invokePrepareReaderImport,
	isTableBlock,
	LARGE_HTML_IMPORT_CANCELED_MESSAGE,
	parseLargeHtmlImportError,
	tableCellTokenKey,
	type NativeReaderToken,
	type PrepareReaderImportInvokeArgs,
} from '@/utils/readerDocument.js';
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
const SMALL_TEXT_SCALE = 0.86;
const HEADING_SCALE = 1.35;
const TABLE_TEXT_SCALE = 0.95;
const TABLE_CELL_INLINE_PADDING = 0.45;
const TABLE_CELL_BLOCK_PADDING = 0.35;
const DELETE_CONFIRMATION_NAME_LIMIT = 5;
const BYTES_PER_KIB = 1024;
const BYTES_PER_MIB = BYTES_PER_KIB * BYTES_PER_KIB;
const READING_ACTIVITY_INTERVAL_MS = 30_000;

function navigateToReaderDocument(documentId: string): void {
	window.location.hash = `#/read/document/${encodeURIComponent(documentId)}`;
}

function navigateToReaderLibrary(): void {
	window.location.hash = '#/read';
}

let activeDocument = $state<ReaderDocument | undefined>(undefined);
let pageIndex = $state(0);
let readingAnchor = 0;
let preparationRevision = 0;
let pages = $state<ReaderPage[]>([]);
let pageLayout = $state<ReaderPageLayout | undefined>(undefined);
let measuredAtomicBlockHeights = $state<Record<string, number>>({});
let importing = $state(false);
let enrichedBlocks: Record<string, boolean> = {};
let flowMetrics: Record<string, ReaderTextMetrics> = {};
let tokenMap = $state<Record<string, ReaderToken[]>>({});
let dictionaryResults = $state<SearchEntry[]>([]);
let dictionaryResultIndex = $state(0);
let dictionaryWord = $state<SearchEntry | undefined>(undefined);
let dictionaryToken = $state<ReaderToken | undefined>(undefined);
let dictionaryAnchor = $state<DOMRect | undefined>(undefined);
// Bumped on every openDictionary() call so the mobile sheet can re-pop to partial
// when a new word is tapped while it's already open. Result-arrow nav does not bump it.
let dictionaryOpenCount = $state(0);
let lastPageTurnDirection = $state<'next' | 'previous' | undefined>(undefined);
let dictionaryRequest = 0;
let documentRequest = 0;
let readingActivity = { next_count: 0, previous_count: 0 };
let readingActivityTimer: ReturnType<typeof setTimeout> | undefined;

function flushReadingActivity(): void {
	clearTimeout(readingActivityTimer);
	readingActivityTimer = undefined;
	if (!readingActivity.next_count && !readingActivity.previous_count) {
		return;
	}
	const payload = readingActivity;
	readingActivity = { next_count: 0, previous_count: 0 };
	telemetry.trackEvent('reader.reading_activity', payload).catch(() => {});
}

function mountTelemetry(): () => void {
	const onVisibilityChange = () => {
		if (document.visibilityState === 'hidden') {
			flushReadingActivity();
		}
	};
	document.addEventListener('visibilitychange', onVisibilityChange);
	window.addEventListener('pagehide', flushReadingActivity);
	return () => {
		flushReadingActivity();
		documentRequest += 1;
		document.removeEventListener('visibilitychange', onVisibilityChange);
		window.removeEventListener('pagehide', flushReadingActivity);
	};
}

function participatesInLinearText(block: ReaderContentBlock): boolean {
	return block.participates_in_linear_text !== false;
}

function getTelemetryErrorName(error: unknown): string {
	return error instanceof Error ? error.name : typeof error;
}

function trackImportFailed(
	sourceType: string,
	stage: 'prepare' | 'pick' | 'save',
	error: unknown
): void {
	telemetry
		.trackEvent('reader.document_import_failed', {
			source_type: sourceType,
			stage,
			error_name: getTelemetryErrorName(error),
		})
		.catch(() => {});
}

async function tokenizeBlock(
	block: ReaderContentBlock,
	includePinyin = false
): Promise<ReaderToken[]> {
	if (!participatesInLinearText(block)) {
		return [];
	}
	const tokenTexts = await invoke<Array<string | NativeReaderToken>>(
		NATIVE_COMMANDS.READER.TOKENIZE_TEXT,
		{
			text: block.text,
			...(includePinyin ? { includePinyin: true } : {}),
		}
	);
	return alignReaderTokens(block.text, tokenTexts, block.id);
}

async function tokenizeTableCell(
	blockId: string,
	row: number,
	col: number,
	text: string,
	includePinyin = false
): Promise<ReaderToken[]> {
	const tokenTexts = await invoke<Array<string | NativeReaderToken>>(
		NATIVE_COMMANDS.READER.TOKENIZE_TEXT,
		{
			text,
			...(includePinyin ? { includePinyin: true } : {}),
		}
	);
	const base = alignReaderTokens(text, tokenTexts, blockId);
	return base.map((token) => ({
		...token,
		table_cell: { row, col },
	}));
}

function createLocator(page: ReaderPage): ReaderLocator {
	const documentText = activeDocument?.text ?? '';
	const exact = documentText.slice(
		readingAnchor,
		Math.min(page.end, readingAnchor + TEXT_CONTEXT_LENGTH)
	);
	const prefix = documentText.slice(
		Math.max(0, readingAnchor - TEXT_CONTEXT_LENGTH),
		readingAnchor
	);
	const suffix = documentText.slice(
		Math.min(documentText.length, readingAnchor + exact.length),
		Math.min(documentText.length, readingAnchor + exact.length + TEXT_CONTEXT_LENGTH)
	);
	const now = new Date().toISOString();
	return {
		resource_href: 'text',
		position: readingAnchor,
		total_progression: documentText.length
			? Math.min(1, readingAnchor / documentText.length)
			: 0,
		page_index: page.index,
		text_position: {
			start: readingAnchor,
			end: Math.min(page.end, readingAnchor + exact.length),
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

function createPagesForCurrentLayout(document: ReaderDocument): ReaderPage[] {
	const lines: Record<string, ReturnType<typeof layoutReaderText>> = {};
	if (pageLayout) {
		for (const block of document.blocks) {
			if (!participatesInLinearText(block)) {
				continue;
			}
			const hasImported = block.spans?.some(
				(span) => span.style === 'ruby' && span.annotation
			);
			if (
				!readerSettingsStore.settings.showPinyin ||
				(!hasImported && !tokenMap[block.id]?.some((token) => token.pinyin))
			) {
				continue;
			}
			const segments = createReaderSegments(
				{
					id: block.id,
					sourceBlockId: block.id,
					kind: block.kind,
					text: block.text,
					sourceText: block.text,
					sourceStart: 0,
					sourceEnd: block.text.length,
					start_offset: block.start_offset ?? 0,
					end_offset: block.end_offset ?? block.text.length,
				},
				tokenMap[block.id] ?? [],
				block.spans,
				readerSettingsStore.settings.showPinyin
			);
			const heading = block.kind === 'heading';
			const small = block.extensions?.block_style?.small_text ? SMALL_TEXT_SCALE : 1;
			const scale = heading ? (pageLayout.headingFontScale ?? HEADING_SCALE) : small;
			const fontSize = pageLayout.fontSize * scale;
			lines[block.id] = layoutReaderText(
				segments,
				flowMetrics[block.id] ?? {
					width: pageLayout.contentWidth,
					fontSize,
					lineHeight: heading ? fontSize * HEADING_SCALE : pageLayout.lineHeight * small,
					fontFamily: pageLayout.fontFamily ?? 'sans-serif',
					fontWeight: heading ? '700' : '400',
					textIndent: resolveReaderTextIndent(
						block.extensions?.block_style?.text_indent,
						fontSize,
						pageLayout.contentWidth
					),
				}
			);
		}
	}
	const result = createReaderPages(
		document,
		pageLayout ? { ...pageLayout, measuredAtomicBlockHeights } : undefined,
		lines
	);
	if (pageLayout) {
		for (const page of result) {
			for (const block of page.blocks) {
				const source = document.blocks.find(
					(candidate) => candidate.id === block.sourceBlockId
				);
				const table = source?.extensions?.table;
				if (!table || !source) {
					continue;
				}
				const cells: NonNullable<ReaderPageBlock['tableSnapshot']>['cells'] = [];
				let y = 0;
				for (const [rowIndex, row] of table.rows.entries()) {
					let x = 0;
					let height = 0;
					for (const [colIndex, cell] of row.cells.entries()) {
						const cellLines = getTableCellLines(
							source.id,
							rowIndex,
							colIndex,
							cell.text
						);
						if (!cellLines) {
							continue;
						}
						const metrics = getTableCellMetrics(source.id, rowIndex, colIndex)!;
						const paddingX = metrics.fontSize * TABLE_CELL_INLINE_PADDING;
						const paddingY = metrics.fontSize * TABLE_CELL_BLOCK_PADDING;
						cells.push({
							x: x + paddingX,
							y: y + paddingY,
							width: metrics.width,
							lines: cellLines,
						});
						x += metrics.width + 2 * paddingX + 1;
						height = Math.max(
							height,
							cellLines.reduce((sum, line) => sum + line.height, 0) + 2 * paddingY + 1
						);
					}
					y += height;
				}
				if (cells.length) {
					block.tableSnapshot = { height: y, cells };
				}
			}
		}
	}
	return result;
}

async function updateFlowMetrics(metrics: Record<string, ReaderTextMetrics>): Promise<void> {
	if (!activeDocument) {
		return;
	}
	const changes = Object.entries(metrics).filter(
		([key, value]) => JSON.stringify(value) !== JSON.stringify(flowMetrics[key])
	);
	if (!changes.length) {
		return;
	}
	flowMetrics = { ...flowMetrics, ...Object.fromEntries(changes) };
	const position = readingAnchor;
	pages = createPagesForCurrentLayout(activeDocument);
	pageIndex = findPageIndexForPosition(pages, position);
	await preparePageTokens();
}

async function refreshPinyin(): Promise<void> {
	if (!activeDocument) {
		return;
	}
	const position = readingAnchor;
	pages = createPagesForCurrentLayout(activeDocument);
	pageIndex = findPageIndexForPosition(pages, position);
	closeDictionary();
	await preparePageTokens();
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
	} catch (error) {
		handleError('There was an error saving reader progress.', error);
	}
}

async function openDocument(document: ReaderDocument): Promise<void> {
	flushReadingActivity();
	const requestId = ++documentRequest;
	activeDocument = ensureReaderDocumentForRendering(document);
	readingAnchor = document.progress?.position ?? 0;
	readerDocumentRouteStore.set(activeDocument._id);
	tokenMap = {};
	enrichedBlocks = {};
	flowMetrics = {};
	measuredAtomicBlockHeights = {};
	lastPageTurnDirection = undefined;
	closeDictionary();
	pages = createPagesForCurrentLayout(activeDocument);
	pageIndex = getPageIndexForLocator(activeDocument, pages);
	await preparePageTokens();
	if (requestId !== documentRequest) {
		return;
	}
	telemetry
		.trackEvent('reader.document_opened', {
			source_type: document.source_type,
		})
		.catch(() => {});
}

async function pickImportDocument(): Promise<ReaderImportPayload | undefined> {
	importing = true;
	try {
		return await invokeImportReaderDocument();
	} catch (error) {
		trackImportFailed('file', 'pick', error);
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
): Promise<ReaderImportResult> {
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
		navigateToReaderDocument(document._id);
		return { status: 'success' };
	} catch (error) {
		trackImportFailed(importPayload.source_type, 'save', error);
		const message = 'There was an error importing the reader document.';
		handleError(message, error, { silent: true });
		return { status: 'error', message };
	} finally {
		importing = false;
	}
}

async function importPlainTextDocument(
	title: string,
	text: string,
	color: string
): Promise<ReaderImportResult> {
	importing = true;
	try {
		const importPayload = await invokePrepareReaderImport({
			text,
			title,
			fileName: 'clipboard.txt',
			mimeType: 'text/plain',
		});
		return await importReaderPayload(importPayload, title || importPayload.title, color);
	} catch (error) {
		trackImportFailed('plain_text', 'prepare', error);
		const message = 'There was an error importing the reader document.';
		handleError(message, error, { silent: true });
		return { status: 'error', message };
	} finally {
		importing = false;
	}
}

async function prepareReaderImportWithLargeHtmlConfirmation(
	args: PrepareReaderImportInvokeArgs
): Promise<ReaderImportPayload> {
	try {
		return await invokePrepareReaderImport(args);
	} catch (error) {
		const largeHtmlError = parseLargeHtmlImportError(error);
		if (!largeHtmlError) {
			throw error;
		}
		const receivedMib = Math.ceil(largeHtmlError.receivedBytes / BYTES_PER_MIB);
		const confirmed = await ask(
			`This webpage is about ${receivedMib} MiB before reader processing. Importing it may use significant memory and storage. Continue?`,
			{ title: 'Import Large Webpage' }
		);
		if (!confirmed) {
			throw new Error(LARGE_HTML_IMPORT_CANCELED_MESSAGE, { cause: error });
		}
		return invokePrepareReaderImport({
			...args,
			allowLargeHtml: true,
		});
	}
}

async function importWebpageDocument(
	title: string,
	url: string,
	color: string,
	preparedPayload?: ReaderImportPayload
): Promise<ReaderImportResult> {
	if (!preparedPayload && networkStatus.isOffline) {
		return {
			status: 'error',
			message: 'You are offline. Connect to the internet to import a webpage.',
		};
	}
	importing = true;
	try {
		const importPayload =
			preparedPayload ??
			(await prepareReaderImportWithLargeHtmlConfirmation({
				url,
				title,
			}));
		return await importReaderPayload(importPayload, title || importPayload.title, color);
	} catch (error) {
		if (error instanceof Error && error.message === LARGE_HTML_IMPORT_CANCELED_MESSAGE) {
			return { status: 'cancelled' };
		}
		trackImportFailed('webpage', 'prepare', error);
		const message = 'There was an error importing the webpage.';
		handleError(message, error, { silent: true });
		return { status: 'error', message };
	} finally {
		importing = false;
	}
}

function trackSupportedDocumentsOpened(): void {
	telemetry.trackEvent('reader.supported_documents_opened', {}).catch(() => {});
}

function trackThemeChanged(theme: string): void {
	telemetry.trackEvent('reader.theme_changed', { theme }).catch(() => {});
}

function trackLayoutChanged(
	setting: string,
	value: number,
	direction?: 'increase' | 'decrease'
): void {
	telemetry
		.trackEvent('reader.layout_changed', {
			setting,
			value,
			...(direction ? { direction } : {}),
		})
		.catch(() => {});
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
			flushReadingActivity();
			documentRequest += 1;
			activeDocument = undefined;
			readerDocumentRouteStore.set(null);
			pageIndex = 0;
			pages = [];
			measuredAtomicBlockHeights = {};
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
			flushReadingActivity();
			documentRequest += 1;
			activeDocument = undefined;
			readerDocumentRouteStore.set(null);
			pageIndex = 0;
			pages = [];
			measuredAtomicBlockHeights = {};
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

async function preparePageTokens(targetIndex = pageIndex): Promise<void> {
	const preparation = ++preparationRevision;
	const request = documentRequest;
	const document = activeDocument;
	const showPinyin = readerSettingsStore.settings.showPinyin;
	const position = readingAnchor;
	const targetPosition = pages[targetIndex]?.start;
	if (!document || targetPosition === undefined) {
		return;
	}
	// Repagination can bring another source block onto the page. Prepare until coverage settles.
	for (;;) {
		const targetPage = pages[findPageIndexForPosition(pages, targetPosition)];
		if (!targetPage) {
			return;
		}
		const sourceIds = new Set(targetPage.blocks.map((block) => block.sourceBlockId));
		const blocks = document.blocks.filter((block) => sourceIds.has(block.id));
		const jobs: Array<{
			key: string;
			text: string;
			blockId: string;
			row?: number;
			col?: number;
		}> = [];
		for (const block of blocks) {
			const table = getTableExtension(block);
			if (isTableBlock(block) && table) {
				table.rows.forEach((row, rowIndex) =>
					row.cells.forEach((cell, col) =>
						jobs.push({
							key: tableCellTokenKey(block.id, rowIndex, col),
							text: cell.text,
							blockId: block.id,
							row: rowIndex,
							col,
						})
					)
				);
			} else if (participatesInLinearText(block)) {
				jobs.push({ key: block.id, text: block.text, blockId: block.id });
			}
		}
		const missing = jobs.filter(
			(job) => !tokenMap[job.key] || (showPinyin && !enrichedBlocks[job.key])
		);
		if (!missing.length) {
			return;
		}
		const results = await Promise.all(
			missing.map(async (job) => {
				try {
					const tokens =
						job.row === undefined
							? await tokenizeBlock(
									{ id: job.blockId, kind: 'paragraph', text: job.text },
									showPinyin
								)
							: await tokenizeTableCell(
									job.blockId,
									job.row,
									job.col!,
									job.text,
									showPinyin
								);
					return [job.key, tokens] as const;
				} catch (error) {
					handleError('Could not prepare Reader pronunciation.', error, { silent: true });
					return [job.key, tokenMap[job.key] ?? []] as const;
				}
			})
		);
		if (
			request !== documentRequest ||
			preparation !== preparationRevision ||
			showPinyin !== readerSettingsStore.settings.showPinyin
		) {
			return;
		}
		for (const job of missing) {
			enrichedBlocks[job.key] = showPinyin;
		}
		tokenMap = { ...tokenMap, ...Object.fromEntries(results) };
		pages = createPagesForCurrentLayout(document);
		pageIndex = findPageIndexForPosition(pages, position);
	}
}

async function preparePageTurn(direction: 'next' | 'previous'): Promise<number | undefined> {
	const request = documentRequest;
	const next = pageIndex + (direction === 'next' ? 1 : -1);
	if (!pages[next]) {
		return undefined;
	}
	await preparePageTokens(next);
	if (request !== documentRequest) {
		return undefined;
	}
	const target = pageIndex + (direction === 'next' ? 1 : -1);
	return pages[target] ? target : undefined;
}

async function goToPage(nextPageIndex: number): Promise<void> {
	if (!activeDocument || !pages[nextPageIndex] || nextPageIndex === pageIndex) {
		return;
	}
	const direction = nextPageIndex > pageIndex ? 'next' : 'previous';
	lastPageTurnDirection = direction;
	pageIndex = nextPageIndex;
	readingAnchor = pages[pageIndex].start;
	readingActivity[direction === 'next' ? 'next_count' : 'previous_count'] += 1;
	readingActivityTimer ??= setTimeout(flushReadingActivity, READING_ACTIVITY_INTERVAL_MS);
	closeDictionary();
	await preparePageTokens();
	await saveCurrentProgress();
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

	const currentPosition = readingAnchor;
	pageLayout = normalizedLayout;
	measuredAtomicBlockHeights = {};
	flowMetrics = {};

	if (!activeDocument) {
		return;
	}

	pages = createPagesForCurrentLayout(activeDocument);
	pageIndex = findPageIndexForPosition(pages, currentPosition);
	closeDictionary();
	await preparePageTokens();
}

async function updateMeasuredAtomicBlockHeights(
	nextMeasurements: Record<string, number>
): Promise<void> {
	if (!activeDocument) {
		return;
	}

	const roundedMeasurements = Object.fromEntries(
		Object.entries(nextMeasurements)
			.map(([blockId, height]) => [blockId, Math.ceil(height)] as const)
			.filter(([, height]) => Number.isFinite(height) && height > 0)
	);
	const changedEntries = Object.entries(roundedMeasurements).filter(
		([blockId, height]) => Math.abs((measuredAtomicBlockHeights[blockId] ?? 0) - height) > 1
	);

	if (!changedEntries.length) {
		return;
	}

	const currentPosition = readingAnchor;
	measuredAtomicBlockHeights = {
		...measuredAtomicBlockHeights,
		...Object.fromEntries(changedEntries),
	};
	pages = createPagesForCurrentLayout(activeDocument);
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
			segments.push(
				...createReaderSegments(
					syntheticBlock,
					cellTokens,
					cell.spans ?? [],
					readerSettingsStore.settings.showPinyin
				)
			);
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
	const sourceBlock = activeDocument.blocks.find((block) => block.id === pageBlock.sourceBlockId);
	return createReaderSegments(
		pageBlock,
		tokenMap[pageBlock.sourceBlockId] ?? [],
		sourceBlock?.spans ?? [],
		readerSettingsStore.settings.showPinyin
	);
}

function getTableCellMetrics(
	blockId: string,
	row: number,
	col: number
): ReaderTextMetrics | undefined {
	if (!pageLayout || !activeDocument) {
		return undefined;
	}
	const table = activeDocument.blocks.find((block) => block.id === blockId)?.extensions?.table;
	if (!table) {
		return undefined;
	}
	const fontSize = pageLayout.fontSize * TABLE_TEXT_SCALE;
	return (
		flowMetrics[tableCellTokenKey(blockId, row, col)] ?? {
			width: Math.max(
				1,
				pageLayout.contentWidth / Math.max(1, table.rows[row].cells.length) -
					fontSize * TABLE_CELL_INLINE_PADDING * 2 -
					1
			),
			fontSize,
			lineHeight: pageLayout.lineHeight * TABLE_TEXT_SCALE,
			fontFamily: pageLayout.fontFamily ?? 'sans-serif',
			fontWeight: table.rows[row].cells[col].is_header ? '700' : '400',
		}
	);
}

function getTableCellLines(blockId: string, row: number, col: number, text: string) {
	// Preserve native table/ruby flow when generated pinyin is disabled.
	if (!readerSettingsStore.settings.showPinyin) {
		return undefined;
	}
	const metrics = getTableCellMetrics(blockId, row, col);
	return metrics
		? layoutReaderText(getTableCellSegments(blockId, row, col, text), metrics)
		: undefined;
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
	const sourceBlock = activeDocument?.blocks.find((block) => block.id === tableBlockId);
	const cellSpans = sourceBlock?.extensions?.table?.rows[rowIndex]?.cells[colIndex]?.spans ?? [];
	return createReaderSegments(
		syntheticBlock,
		tokenMap[key] ?? [],
		cellSpans,
		readerSettingsStore.settings.showPinyin
	);
}

async function openDictionary(token: ReaderToken, anchor?: DOMRect): Promise<void> {
	const requestId = ++dictionaryRequest;
	try {
		const results = await invoke<SearchEntry[]>(NATIVE_COMMANDS.DICTIONARY.QUERY_BY_CHINESE, {
			text: token.text,
		});
		if (requestId !== dictionaryRequest || !results.length) {
			return;
		}
		const exactMatchIndex = results.findIndex(
			(result) => result.simplified === token.text || result.traditional === token.text
		);
		dictionaryResults = results;
		dictionaryResultIndex = exactMatchIndex >= 0 ? exactMatchIndex : 0;
		dictionaryWord = dictionaryResults[dictionaryResultIndex];
		dictionaryToken = token;
		dictionaryAnchor = anchor;
		dictionaryOpenCount += 1;
		telemetry
			.trackEvent('dictionary.word_opened', { source: 'reader', interaction: 'token' })
			.catch(() => {});
	} catch (error) {
		handleError('There was an error opening the dictionary popover.', error);
	}
}

function selectDictionaryResult(index: number): void {
	if (!dictionaryResults[index] || index === dictionaryResultIndex) {
		return;
	}
	dictionaryResultIndex = index;
	dictionaryWord = dictionaryResults[index];
	telemetry
		.trackEvent('dictionary.word_opened', {
			source: 'reader',
			interaction: 'popover_result',
			result_position: index + 1,
			result_count: dictionaryResults.length,
		})
		.catch(() => {});
}

async function lookupDictionaryWord(request: DictionaryLookupRequest): Promise<void> {
	const lookup = normalizeDictionaryLookupRequest(request);
	const requestId = ++dictionaryRequest;
	try {
		const results = lookup.lexicalId
			? await invoke<SearchEntry | null>(NATIVE_COMMANDS.DICTIONARY.QUERY_BY_ID, {
					id: lookup.lexicalId,
				}).then((result) => (result ? [result] : []))
			: await invoke<SearchEntry[]>(NATIVE_COMMANDS.DICTIONARY.QUERY_BY_CHINESE, {
					text: lookup.text,
				});
		if (requestId !== dictionaryRequest || !results.length) {
			return;
		}
		const exactMatchIndex = results.findIndex(
			(result) => result.simplified === lookup.text || result.traditional === lookup.text
		);
		dictionaryResults = results;
		dictionaryResultIndex = exactMatchIndex >= 0 ? exactMatchIndex : 0;
		dictionaryWord = dictionaryResults[dictionaryResultIndex];
		if (lookup.anchor) {
			dictionaryAnchor = lookup.anchor;
		}
		// Bump so the mobile sheet re-pops to partial when a cross-link (e.g. a measure word)
		// is tapped while the sheet is open. Mirrors openDictionary()'s behavior.
		dictionaryOpenCount += 1;
		telemetry
			.trackEvent('dictionary.word_opened', { source: 'reader', interaction: 'link' })
			.catch(() => {});
	} catch (error) {
		handleError('There was an error looking up the dictionary word.', error);
	}
}

function closeDictionary(): void {
	dictionaryRequest += 1;
	dictionaryResults = [];
	dictionaryResultIndex = 0;
	dictionaryWord = undefined;
	dictionaryToken = undefined;
	dictionaryAnchor = undefined;
}

function backToLibrary(): void {
	flushReadingActivity();
	documentRequest += 1;
	saveCurrentProgress().catch(() => {});
	activeDocument = undefined;
	readerDocumentRouteStore.set(null);
	pageIndex = 0;
	pages = [];
	measuredAtomicBlockHeights = {};
	lastPageTurnDirection = undefined;
	closeDictionary();
}

async function openDocumentById(documentId: string): Promise<void> {
	const document = readerDocumentsStore.documents.find(
		(candidate) => candidate._id === documentId
	);
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
	navigateToReaderLibrary();
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
	refreshPinyin,
	updateFlowMetrics,
	preparePageTurn,
	mountTelemetry,
	flushReadingActivity,
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
	get dictionaryOpenCount(): number {
		return dictionaryOpenCount;
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
	trackSupportedDocumentsOpened,
	trackThemeChanged,
	trackLayoutChanged,
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
	updateMeasuredAtomicBlockHeights,
	getBlockSegments,
	getTableCellSegments,
	getTableCellLines,
	openDictionary,
	lookupDictionaryWord,
	selectDictionaryResult,
	closeDictionary,
	backToLibrary,
};
