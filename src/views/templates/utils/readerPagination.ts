import type {
	ReaderContentBlock,
	ReaderDocument,
	ReaderBlockStyleExtension,
	ReaderInlineSpan,
	ReaderToken,
} from '@/types/reader.js';

const DEFAULT_CONTENT_WIDTH = 760;
const DEFAULT_CONTENT_HEIGHT = 920;
const DEFAULT_FONT_SIZE = 20;
const DEFAULT_LINE_HEIGHT = 40;
const DEFAULT_BLOCK_GAP = 28;
const DEFAULT_HEADING_LINE_HEIGHT = 30;
const DEFAULT_HEADING_GAP = 28;
const HEADING_CHARACTER_WIDTH_SCALE = 0.9;
const TABLE_ROW_HEIGHT_SCALE = 1.0;
const IMAGE_FALLBACK_HEIGHT_EM = 8;

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

export type ReaderPageBlockLayoutMode = 'flow' | 'atomic';

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
	/** Flow slices participate in line wrapping; atomic is one box (table / image). */
	layout_mode?: ReaderPageBlockLayoutMode;
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
	annotation?: string;
}

interface LineSlice {
	start: number;
	end: number;
}

interface PaginationState {
	pages: ReaderPage[];
	pageBlocks: ReaderPageBlock[];
	usedHeight: number;
	lastLinearTextEnd: number;
}

function participatesInLinearText(block: ReaderContentBlock): boolean {
	return block.participates_in_linear_text !== false;
}

function blockBaseOffset(block: ReaderContentBlock): number {
	return block.start_offset ?? 0;
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

function estimateTableHeight(block: ReaderContentBlock, layout: ReaderPageLayout): number {
	const table = block.extensions?.table;
	const rowCount = table?.rows?.length ?? 1;
	const rowHeight = layout.lineHeight * TABLE_ROW_HEIGHT_SCALE;
	return Math.max(rowHeight, rowCount * rowHeight);
}

function estimateImageHeight(block: ReaderContentBlock, layout: ReaderPageLayout): number {
	const heightPx = block.extensions?.image?.height;
	if (typeof heightPx === 'number' && heightPx > 0) {
		return Math.min(layout.contentHeight, heightPx);
	}
	return layout.fontSize * IMAGE_FALLBACK_HEIGHT_EM;
}

function estimateAtomicBlockHeight(block: ReaderContentBlock, layout: ReaderPageLayout): number {
	if (block.kind === 'thematic_break') {
		return layout.lineHeight;
	}
	if (block.kind === 'table') {
		return estimateTableHeight(block, layout);
	}
	if (block.kind === 'image') {
		return estimateImageHeight(block, layout);
	}
	return layout.lineHeight * 2;
}

function getBlockStyle(block: ReaderContentBlock): ReaderBlockStyleExtension | undefined {
	return block.extensions?.block_style;
}

function isUnsplittableFlowBlock(block: ReaderContentBlock): boolean {
	const style = getBlockStyle(block);
	return Boolean(style?.note || style?.boxed || style?.poem);
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
	const baseOffset = blockBaseOffset(sourceBlock);
	const previousBlock = pageBlocks[pageBlocks.length - 1];

	if (
		previousBlock?.layout_mode !== 'atomic' &&
		previousBlock?.sourceBlockId === sourceBlock.id &&
		previousBlock.sourceEnd === sourceStart
	) {
		previousBlock.sourceEnd = sourceEnd;
		previousBlock.end_offset = baseOffset + sourceEnd;
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
		start_offset: baseOffset + sourceStart,
		end_offset: baseOffset + sourceEnd,
		layout_mode: 'flow',
	});
}

function appendAtomicPageBlock(
	pageBlocks: ReaderPageBlock[],
	sourceBlock: ReaderContentBlock,
	anchorOffset: number
): void {
	pageBlocks.push({
		id: `${sourceBlock.id}:atomic`,
		sourceBlockId: sourceBlock.id,
		kind: sourceBlock.kind,
		text: sourceBlock.text,
		sourceText: sourceBlock.text,
		sourceStart: 0,
		sourceEnd: sourceBlock.text.length,
		start_offset: anchorOffset,
		/** Exclusive upper bound so half-open locator ranges work when the page is atomic-only. */
		end_offset: anchorOffset + 1,
		layout_mode: 'atomic',
	});
}

function pushCurrentPage(state: PaginationState): void {
	if (!state.pageBlocks.length) {
		return;
	}

	const pageStart = state.pageBlocks.length
		? Math.min(...state.pageBlocks.map((block) => block.start_offset))
		: state.lastLinearTextEnd;
	const pageEnd = state.pageBlocks.length
		? Math.max(...state.pageBlocks.map((block) => block.end_offset))
		: state.lastLinearTextEnd + 1;

	state.pages.push({
		index: state.pages.length,
		start: pageStart,
		end: pageEnd,
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
		lastLinearTextEnd: 0,
	};

	for (const sourceBlock of document.blocks) {
		const blockGap = getBlockGap(normalizedLayout, sourceBlock.kind);

		if (!participatesInLinearText(sourceBlock)) {
			const atomicHeight = estimateAtomicBlockHeight(sourceBlock, normalizedLayout);
			const atomicDoesNotFit =
				state.pageBlocks.length > 0 &&
				state.usedHeight + atomicHeight > normalizedLayout.contentHeight;

			if (atomicDoesNotFit) {
				pushCurrentPage(state);
			}

			appendAtomicPageBlock(state.pageBlocks, sourceBlock, state.lastLinearTextEnd);
			state.usedHeight += atomicHeight;
			state.usedHeight += blockGap;
			continue;
		}

		const charactersPerLine = getCharacterCapacity(normalizedLayout, sourceBlock.kind);
		const lineHeight = getBlockLineHeight(normalizedLayout, sourceBlock.kind);
		const lineSlices = createLineSlices(sourceBlock.text, charactersPerLine);

		if (isUnsplittableFlowBlock(sourceBlock)) {
			const blockHeight = Math.max(lineHeight, lineSlices.length * lineHeight);
			const blockDoesNotFit =
				state.pageBlocks.length > 0 &&
				state.usedHeight + blockHeight > normalizedLayout.contentHeight;

			if (blockDoesNotFit) {
				pushCurrentPage(state);
			}

			appendPageBlock(state.pageBlocks, sourceBlock, 0, sourceBlock.text.length);
			state.usedHeight += blockHeight;
			const blockEnd =
				sourceBlock.end_offset ?? blockBaseOffset(sourceBlock) + sourceBlock.text.length;
			state.lastLinearTextEnd = Math.max(state.lastLinearTextEnd, blockEnd);
			state.usedHeight += blockGap;
			continue;
		}

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

		const blockEnd =
			sourceBlock.end_offset ?? blockBaseOffset(sourceBlock) + sourceBlock.text.length;
		state.lastLinearTextEnd = Math.max(state.lastLinearTextEnd, blockEnd);
		state.usedHeight += blockGap;
	}

	pushCurrentPage(state);

	if (!state.pages.length) {
		const startOffset = document.blocks[0] ? blockBaseOffset(document.blocks[0]) : 0;
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
	sourceTokens: ReaderToken[],
	sourceSpans: ReaderInlineSpan[] = []
): ReaderSegment[] {
	if (block.layout_mode === 'atomic') {
		return [{ type: 'text', text: block.text || '\u00a0' }];
	}

	const visibleTokens = sourceTokens.filter(
		(token) => token.end > block.sourceStart && token.start < block.sourceEnd
	);
	const rubySpans = sourceSpans.filter(
		(span) =>
			span.style === 'ruby' &&
			typeof span.annotation === 'string' &&
			span.annotation.trim() &&
			span.end > block.sourceStart &&
			span.start < block.sourceEnd
	);
	const boundaries = new Set<number>([0, block.text.length]);
	for (const token of visibleTokens) {
		boundaries.add(Math.max(token.start, block.sourceStart) - block.sourceStart);
		boundaries.add(Math.min(token.end, block.sourceEnd) - block.sourceStart);
	}
	for (const span of rubySpans) {
		boundaries.add(Math.max(span.start, block.sourceStart) - block.sourceStart);
		boundaries.add(Math.min(span.end, block.sourceEnd) - block.sourceStart);
	}
	const sortedBoundaries = [...boundaries].sort((a, b) => a - b);
	const segments: ReaderSegment[] = [];

	for (let index = 0; index < sortedBoundaries.length - 1; index += 1) {
		const start = sortedBoundaries[index]!;
		const end = sortedBoundaries[index + 1]!;
		if (end <= start) {
			continue;
		}

		const absoluteStart = block.sourceStart + start;
		const absoluteEnd = block.sourceStart + end;
		const sourceToken = visibleTokens.find(
			(token) => token.start < absoluteEnd && token.end > absoluteStart
		);
		const rubySpan = rubySpans.find(
			(span) => span.start <= absoluteStart && span.end >= absoluteEnd
		);
		const text = block.text.slice(start, end);

		if (sourceToken) {
			segments.push({
				type: 'token',
				text,
				annotation: rubySpan?.annotation,
				token: {
					text: sourceToken.text,
					start: sourceToken.start,
					end: sourceToken.end,
					block_id: sourceToken.block_id ?? block.sourceBlockId,
					table_cell: sourceToken.table_cell,
				},
			});
		} else {
			segments.push({
				type: 'text',
				text,
				annotation: rubySpan?.annotation,
			});
		}
	}

	return segments.length ? segments : [{ type: 'text', text: block.text }];
}
