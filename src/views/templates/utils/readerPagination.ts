import type { ReaderContentBlock, ReaderDocument, ReaderToken } from '@/types/reader.js';

const DEFAULT_CONTENT_WIDTH = 760;
const DEFAULT_CONTENT_HEIGHT = 920;
const DEFAULT_FONT_SIZE = 20;
const DEFAULT_LINE_HEIGHT = 40;
const DEFAULT_BLOCK_GAP = 28;
const DEFAULT_HEADING_LINE_HEIGHT = 30;
const DEFAULT_HEADING_GAP = 28;
const HEADING_CHARACTER_WIDTH_SCALE = 0.9;

export interface ReaderPageLayout {
	contentWidth: number;
	contentHeight: number;
	fontSize: number;
	lineHeight: number;
	blockGap: number;
	headingLineHeight: number;
	headingGap: number;
	averageCharacterWidth?: number;
}

export interface ReaderPageBlock {
	id: string;
	sourceBlockId: string;
	kind: ReaderContentBlock['kind'];
	text: string;
	sourceText: string;
	sourceStart: number;
	sourceEnd: number;
	start_offset: number;
	end_offset: number;
}

export interface ReaderPage {
	index: number;
	start: number;
	end: number;
	blocks: ReaderPageBlock[];
}

export interface ReaderSegment {
	type: 'text' | 'token';
	text: string;
	token?: ReaderToken;
}

interface LineSlice {
	start: number;
	end: number;
}

interface PaginationState {
	pages: ReaderPage[];
	pageBlocks: ReaderPageBlock[];
	usedHeight: number;
}

function normalizeLayout(layout: ReaderPageLayout | undefined): ReaderPageLayout {
	return {
		contentWidth: Math.max(1, layout?.contentWidth ?? DEFAULT_CONTENT_WIDTH),
		contentHeight: Math.max(1, layout?.contentHeight ?? DEFAULT_CONTENT_HEIGHT),
		fontSize: Math.max(1, layout?.fontSize ?? DEFAULT_FONT_SIZE),
		lineHeight: Math.max(1, layout?.lineHeight ?? DEFAULT_LINE_HEIGHT),
		blockGap: Math.max(0, layout?.blockGap ?? DEFAULT_BLOCK_GAP),
		headingLineHeight: Math.max(1, layout?.headingLineHeight ?? DEFAULT_HEADING_LINE_HEIGHT),
		headingGap: Math.max(0, layout?.headingGap ?? DEFAULT_HEADING_GAP),
		averageCharacterWidth: Math.max(
			1,
			layout?.averageCharacterWidth ?? layout?.fontSize ?? DEFAULT_FONT_SIZE
		),
	};
}

function getCharacterCapacity(layout: ReaderPageLayout, kind: ReaderContentBlock['kind']): number {
	const characterWidth =
		kind === 'heading'
			? Math.max(
					layout.averageCharacterWidth ?? layout.fontSize,
					layout.fontSize * HEADING_CHARACTER_WIDTH_SCALE
				)
			: (layout.averageCharacterWidth ?? layout.fontSize);
	return Math.max(1, Math.floor(layout.contentWidth / characterWidth));
}

function getBlockLineHeight(layout: ReaderPageLayout, kind: ReaderContentBlock['kind']): number {
	return kind === 'heading' ? layout.headingLineHeight : layout.lineHeight;
}

function getBlockGap(layout: ReaderPageLayout, kind: ReaderContentBlock['kind']): number {
	return kind === 'heading' ? layout.headingGap : layout.blockGap;
}

function createLineSlices(text: string, charactersPerLine: number): LineSlice[] {
	const slices: LineSlice[] = [];
	let segmentStart = 0;

	while (segmentStart < text.length) {
		const segmentLimit = Math.min(text.length, segmentStart + charactersPerLine);
		const newlineIndex = text.indexOf('\n', segmentStart);
		const segmentEnd =
			newlineIndex >= segmentStart && newlineIndex < segmentLimit
				? newlineIndex + 1
				: segmentLimit;

		slices.push({
			start: segmentStart,
			end: segmentEnd,
		});
		segmentStart = segmentEnd;
	}

	return slices.length ? slices : [{ start: 0, end: 0 }];
}

function appendPageBlock(
	pageBlocks: ReaderPageBlock[],
	sourceBlock: ReaderContentBlock,
	sourceStart: number,
	sourceEnd: number
): void {
	const previousBlock = pageBlocks[pageBlocks.length - 1];

	if (
		previousBlock?.sourceBlockId === sourceBlock.id &&
		previousBlock.sourceEnd === sourceStart
	) {
		previousBlock.sourceEnd = sourceEnd;
		previousBlock.end_offset = sourceBlock.start_offset + sourceEnd;
		previousBlock.text = sourceBlock.text.slice(previousBlock.sourceStart, sourceEnd);
		previousBlock.id = `${sourceBlock.id}:${previousBlock.sourceStart}:${sourceEnd}`;
		return;
	}

	pageBlocks.push({
		id: `${sourceBlock.id}:${sourceStart}:${sourceEnd}`,
		sourceBlockId: sourceBlock.id,
		kind: sourceBlock.kind,
		text: sourceBlock.text.slice(sourceStart, sourceEnd),
		sourceText: sourceBlock.text,
		sourceStart,
		sourceEnd,
		start_offset: sourceBlock.start_offset + sourceStart,
		end_offset: sourceBlock.start_offset + sourceEnd,
	});
}

function pushCurrentPage(state: PaginationState): void {
	if (!state.pageBlocks.length) {
		return;
	}

	state.pages.push({
		index: state.pages.length,
		start: state.pageBlocks[0].start_offset,
		end: state.pageBlocks[state.pageBlocks.length - 1].end_offset,
		blocks: state.pageBlocks,
	});
	state.pageBlocks = [];
	state.usedHeight = 0;
}

export function createReaderPages(
	document: ReaderDocument | undefined,
	layout: ReaderPageLayout | undefined
): ReaderPage[] {
	if (!document) {
		return [];
	}

	const normalizedLayout = normalizeLayout(layout);
	const state: PaginationState = {
		pages: [],
		pageBlocks: [],
		usedHeight: 0,
	};

	for (const sourceBlock of document.blocks) {
		const charactersPerLine = getCharacterCapacity(normalizedLayout, sourceBlock.kind);
		const lineHeight = getBlockLineHeight(normalizedLayout, sourceBlock.kind);
		const blockGap = getBlockGap(normalizedLayout, sourceBlock.kind);
		const lineSlices = createLineSlices(sourceBlock.text, charactersPerLine);

		for (const lineSlice of lineSlices) {
			const lineDoesNotFit =
				state.pageBlocks.length > 0 &&
				state.usedHeight + lineHeight > normalizedLayout.contentHeight;

			if (lineDoesNotFit) {
				pushCurrentPage(state);
			}

			appendPageBlock(state.pageBlocks, sourceBlock, lineSlice.start, lineSlice.end);
			state.usedHeight += lineHeight;
		}

		state.usedHeight += blockGap;
	}

	pushCurrentPage(state);

	if (!state.pages.length) {
		const startOffset = document.blocks[0]?.start_offset ?? 0;
		return [
			{
				index: 0,
				start: startOffset,
				end: startOffset,
				blocks: [],
			},
		];
	}

	return state.pages;
}

export function findPageIndexForPosition(pages: ReaderPage[], position: number): number {
	const page = pages.find(
		(readerPage) => position >= readerPage.start && position < readerPage.end
	);
	return page?.index ?? Math.max(0, pages.length - 1);
}

export function createReaderSegments(
	block: ReaderPageBlock,
	sourceTokens: ReaderToken[]
): ReaderSegment[] {
	const visibleTokens = sourceTokens.filter(
		(token) => token.end > block.sourceStart && token.start < block.sourceEnd
	);
	const segments: ReaderSegment[] = [];
	let cursor = 0;

	for (const sourceToken of visibleTokens) {
		const tokenStart = Math.max(sourceToken.start, block.sourceStart) - block.sourceStart;
		const tokenEnd = Math.min(sourceToken.end, block.sourceEnd) - block.sourceStart;

		if (tokenStart > cursor) {
			segments.push({
				type: 'text',
				text: block.text.slice(cursor, tokenStart),
			});
		}

		segments.push({
			type: 'token',
			text: block.text.slice(tokenStart, tokenEnd),
			token: {
				text: sourceToken.text,
				start: tokenStart,
				end: tokenEnd,
			},
		});
		cursor = tokenEnd;
	}

	if (cursor < block.text.length) {
		segments.push({
			type: 'text',
			text: block.text.slice(cursor),
		});
	}

	return segments.length ? segments : [{ type: 'text', text: block.text }];
}
