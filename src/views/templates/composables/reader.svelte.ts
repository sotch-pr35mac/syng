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
	NormalizedReaderLocator,
	ReaderLookupTarget,
} from '@/types/reader.js';
import type { SearchEntry } from '@/types/search.js';
import { handleError, telemetry } from '@/utils';
import { applyReaderImportMetadata } from '@/utils/readerDocumentMetadata.js';
import { pickReaderImportFile } from '@/utils/readerFileImport.js';
import { createPlainTextReaderImportPayload } from '@/utils/readerPlainTextImport.js';
import { createWebpageReaderImportPayload } from '@/utils/readerWebpageImport.js';
import { openReaderPublication } from '@/reader/publication/index.js';
import { ReaderSession, type ReaderSessionState } from '@/reader/session/readerSession.js';
import { DEFAULT_READER_SETTINGS } from '@/reader/settings/defaults.js';
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
let activePublicationSession = $state<ReaderSession | undefined>(undefined);
let activePublicationState = $state<ReaderSessionState | undefined>(undefined);
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

function isPublicationDocument(document: ReaderDocument): boolean {
	return document.source_type !== 'plain_text';
}

function toPublicationLocator(document: ReaderDocument): NormalizedReaderLocator | undefined {
	const resourceHref = document.progress?.resource_href;
	if (!resourceHref) {
		return undefined;
	}
	if (document.source_type === 'pdf') {
		return {
			type: 'pdf',
			resourceHref,
			pageIndex: document.progress.page_index ?? 0,
			progression: document.progress.total_progression ?? 0,
			updatedAt: document.progress.updated_at,
		};
	}
	return {
		type: 'reflowable',
		resourceHref,
		progression: document.progress.total_progression ?? 0,
		updatedAt: document.progress.updated_at,
	};
}

function createPublicationProgress(state: ReaderSessionState): ReaderLocator {
	const resourceIndex = state.publication.readingOrder.findIndex(
		(item) => item.href === state.locator.resourceHref
	);
	const safeResourceIndex = Math.max(0, resourceIndex);
	const totalResources = Math.max(1, state.publication.readingOrder.length);
	const totalProgression =
		totalResources === 1
			? Math.max(0, Math.min(1, state.locator.progression))
			: Math.max(0, Math.min(1, safeResourceIndex / Math.max(1, totalResources - 1)));
	const now = new Date().toISOString();
	return {
		resource_href: state.locator.resourceHref,
		position: 0,
		total_progression: totalProgression,
		page_index: safeResourceIndex,
		text_position: {
			start: 0,
			end: 0,
		},
		text_quote: {
			exact: '',
			prefix: '',
			suffix: '',
		},
		updated_at: now,
	};
}

async function loadPublicationDocument(document: ReaderDocument): Promise<ReaderSessionState> {
	const sourceData = await readerDocumentsStore.getSourceData(document._id);
	const publication = await openReaderPublication({
		id: document._id,
		title: document.title,
		fileName: document.file_name,
		mimeType: document.mime_type,
		sourceUrl: document.source_url,
		importedAt: document.imported_at,
		text: document.source_html ? undefined : document.text,
		html: document.source_html,
		data: sourceData,
	});
	const session = new ReaderSession(publication, DEFAULT_READER_SETTINGS, toPublicationLocator(document));
	activePublicationSession = session;
	activePublicationState = session.state;
	return activePublicationState;
}

async function saveCurrentProgress(): Promise<void> {
	if (!activeDocument || !pages[pageIndex]) {
		if (activeDocument && activePublicationState) {
			try {
				activeDocument = await readerDocumentsStore.updateProgress(
					activeDocument._id,
					createPublicationProgress(activePublicationState)
				);
				telemetry.trackEvent('reader.position_saved', {}).catch(() => {});
			} catch (error) {
				handleError('There was an error saving reader progress.', error);
			}
		}
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
	activePublicationSession = undefined;
	activePublicationState = undefined;
	tokenMap = {};
	lastPageTurnDirection = undefined;
	closeDictionary();
	if (isPublicationDocument(document)) {
		try {
			await loadPublicationDocument(document);
			pageIndex =
				activePublicationState?.locator.type === 'pdf'
					? activePublicationState.locator.pageIndex
					: Math.max(
							0,
							activePublicationState?.publication.readingOrder.findIndex(
								(item) => item.href === activePublicationState?.locator.resourceHref
							) ?? 0
						);
			pages = [];
		} catch (error) {
			activeDocument = undefined;
			activePublicationSession = undefined;
			activePublicationState = undefined;
			handleError('There was an error opening the reader document.', error);
			return;
		}
	} else {
		pages = createReaderPages(document, pageLayout);
		pageIndex = getPageIndexForLocator(document, pages);
		await preparePageTokens();
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
	await importReaderPayload(
		createPlainTextReaderImportPayload(title, text, { color }),
		title,
		color
	);
}

async function importWebpageDocument(
	title: string,
	html: string,
	color: string,
	sourceUrl: string
): Promise<void> {
	await importReaderPayload(
		createWebpageReaderImportPayload(title, html, sourceUrl, color),
		title,
		color
	);
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
			activePublicationSession = undefined;
			activePublicationState = undefined;
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
			activePublicationSession = undefined;
			activePublicationState = undefined;
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
	if (activeDocument && activePublicationSession && activePublicationState) {
		const targetResource = activePublicationState.publication.readingOrder[nextPageIndex];
		if (!targetResource) {
			return;
		}
		const direction = nextPageIndex > pageIndex ? 'next' : 'previous';
		lastPageTurnDirection = direction;
		pageIndex = nextPageIndex;
		activePublicationState = activePublicationSession.goTo({
			type: activePublicationState.publication.format === 'pdf' ? 'pdf' : 'reflowable',
			resourceHref: targetResource.href,
			pageIndex: nextPageIndex,
			progression: 0,
			updatedAt: new Date().toISOString(),
		} as NormalizedReaderLocator);
		closeDictionary();
		await saveCurrentProgress();
		telemetry
			.trackEvent('reader.page_changed', {
				direction,
			})
			.catch(() => {});
		return;
	}
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

	if (!activeDocument || activePublicationState) {
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

async function openLookupTarget(target: ReaderLookupTarget): Promise<void> {
	try {
		const results = await invoke<SearchEntry[]>(NATIVE_COMMANDS.DICTIONARY.QUERY_BY_CHINESE, {
			text: target.text,
		});
		const exactMatchIndex = results.findIndex(
			(result) => result.simplified === target.text || result.traditional === target.text
		);
		dictionaryResults = results;
		dictionaryResultIndex = exactMatchIndex >= 0 ? exactMatchIndex : 0;
		dictionaryWord = dictionaryResults[dictionaryResultIndex];
		dictionaryToken = {
			text: target.text,
			start: target.offset ?? 0,
			end: (target.offset ?? 0) + target.text.length,
		};
		dictionaryAnchor = target.anchor;
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
	activePublicationSession = undefined;
	activePublicationState = undefined;
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
	get activePublicationState(): ReaderSessionState | undefined {
		return activePublicationState;
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
		return activePublicationState?.publication.readingOrder.length ?? pages.length;
	},
	get importing(): boolean {
		return importing;
	},
	get canGoPrevious(): boolean {
		return activePublicationState?.canGoBackward ?? pageIndex > 0;
	},
	get canGoNext(): boolean {
		return activePublicationState?.canGoForward ?? pageIndex < pages.length - 1;
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
	pickImportDocument,
	importReaderPayload,
	importPlainTextDocument,
	importWebpageDocument,
	updateDocumentMetadata,
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
	openLookupTarget,
	selectDictionaryResult,
	closeDictionary,
	backToLibrary,
};
