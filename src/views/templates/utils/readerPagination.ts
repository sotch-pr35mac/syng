import type {
	ReaderContentBlock,
	ReaderDocument,
	ReaderBlockStyleExtension,
	ReaderInlineSpan,
	ReaderToken,
	ReaderThemeSettings,
	NormalizedReaderLocator,
} from '@/types/reader.js';

const DEFAULT_CONTENT_WIDTH = 760;
const DEFAULT_CONTENT_HEIGHT = 920;
const DEFAULT_FONT_SIZE = 20;
const DEFAULT_LINE_HEIGHT = 40;
const DEFAULT_BLOCK_GAP = 28;
const DEFAULT_HEADING_LINE_HEIGHT = 30;
const DEFAULT_HEADING_GAP = 28;
const DEFAULT_HEADING_FONT_SCALE = 1.35;
const TABLE_ROW_HEIGHT_SCALE = 1.25;
export const READER_IMAGE_MAX_WIDTH_RATIO = 0.7;
export const READER_IMAGE_MAX_HEIGHT_RATIO = 0.65;
export const READER_TABLE_MAX_HEIGHT_RATIO = 0.75;
const HIGH_SURROGATE_MIN = 0xd800;
const HIGH_SURROGATE_MAX = 0xdbff;
const LOW_SURROGATE_MIN = 0xdc00;
const LOW_SURROGATE_MAX = 0xdfff;

export interface ReaderPageLayout {
	contentWidth: number;
	contentHeight: number;
	fontSize: number;
	lineHeight: number;
	blockGap: number;
	headingLineHeight: number;
	headingGap: number;
	/** Font-size multiplier applied to headings when they render (used for capacity math). */
	headingFontScale?: number;
	averageCharacterWidth?: number;
	measuredAtomicBlockHeights?: Record<string, number>;
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
	const measuredAtomicBlockHeights = Object.fromEntries(
		Object.entries(layout?.measuredAtomicBlockHeights ?? {}).filter(
			([, height]) => Number.isFinite(height) && height > 0
		)
	);

	return {
		contentWidth: Math.max(1, layout?.contentWidth ?? DEFAULT_CONTENT_WIDTH),
		contentHeight: Math.max(1, layout?.contentHeight ?? DEFAULT_CONTENT_HEIGHT),
		fontSize: Math.max(1, layout?.fontSize ?? DEFAULT_FONT_SIZE),
		lineHeight: Math.max(1, layout?.lineHeight ?? DEFAULT_LINE_HEIGHT),
		blockGap: Math.max(0, layout?.blockGap ?? DEFAULT_BLOCK_GAP),
		headingLineHeight: Math.max(1, layout?.headingLineHeight ?? DEFAULT_HEADING_LINE_HEIGHT),
		headingGap: Math.max(0, layout?.headingGap ?? DEFAULT_HEADING_GAP),
		headingFontScale: Math.max(1, layout?.headingFontScale ?? DEFAULT_HEADING_FONT_SCALE),
		averageCharacterWidth: Math.max(
			1,
			layout?.averageCharacterWidth ?? layout?.fontSize ?? DEFAULT_FONT_SIZE
		),
		measuredAtomicBlockHeights,
	};
}

function getCharacterCapacity(layout: ReaderPageLayout, kind: ReaderContentBlock['kind']): number {
	const baseCharacterWidth = layout.averageCharacterWidth ?? layout.fontSize;
	// Headings render larger than body text (headingFontScale), so their glyphs are wider and
	// fewer fit per line. Scaling the character width keeps the estimated line count (and thus
	// the heading's height) from being undercounted, which would clip a wrapped heading.
	const characterWidth =
		kind === 'heading'
			? baseCharacterWidth * (layout.headingFontScale ?? DEFAULT_HEADING_FONT_SCALE)
			: baseCharacterWidth;
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
	const maxHeight = layout.contentHeight * READER_TABLE_MAX_HEIGHT_RATIO;
	const rowHeight = layout.lineHeight * TABLE_ROW_HEIGHT_SCALE;
	const estimatedHeight = Math.max(rowHeight, rowCount * rowHeight);
	return Math.min(maxHeight, estimatedHeight);
}

function estimateImageHeight(block: ReaderContentBlock, layout: ReaderPageLayout): number {
	const maxWidth = layout.contentWidth * READER_IMAGE_MAX_WIDTH_RATIO;
	const maxHeight = layout.contentHeight * READER_IMAGE_MAX_HEIGHT_RATIO;
	const widthPx = block.extensions?.image?.width;
	const heightPx = block.extensions?.image?.height;

	if (
		typeof widthPx === 'number' &&
		widthPx > 0 &&
		typeof heightPx === 'number' &&
		heightPx > 0
	) {
		const renderedWidth = Math.min(widthPx, maxWidth);
		const scaledHeight = heightPx * (renderedWidth / widthPx);
		return Math.min(maxHeight, scaledHeight);
	}

	if (typeof heightPx === 'number' && heightPx > 0) {
		return Math.min(maxHeight, heightPx);
	}

	return maxHeight;
}

function estimateAtomicBlockHeight(block: ReaderContentBlock, layout: ReaderPageLayout): number {
	const measuredHeight = layout.measuredAtomicBlockHeights?.[block.id];
	if (typeof measuredHeight === 'number' && measuredHeight > 0) {
		return Math.min(layout.contentHeight, measuredHeight);
	}
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

/**
 * If `index` falls between a surrogate pair, advance past the low surrogate so a line/page
 * boundary never splits an astral-plane character (CJK Extension B, emoji) into lone
 * surrogates (which render as U+FFFD and misalign token offsets).
 */
function alignToCodePointBoundary(text: string, index: number): number {
	if (index <= 0 || index >= text.length) {
		return index;
	}
	const previousUnit = text.charCodeAt(index - 1);
	const currentUnit = text.charCodeAt(index);
	const isHighSurrogate =
		previousUnit >= HIGH_SURROGATE_MIN && previousUnit <= HIGH_SURROGATE_MAX;
	const isLowSurrogate = currentUnit >= LOW_SURROGATE_MIN && currentUnit <= LOW_SURROGATE_MAX;
	return isHighSurrogate && isLowSurrogate ? index + 1 : index;
}

function createLineSlices(text: string, charactersPerLine: number): LineSlice[] {
	const slices: LineSlice[] = [];
	let segmentStart = 0;

	while (segmentStart < text.length) {
		const segmentLimit = alignToCodePointBoundary(
			text,
			Math.min(text.length, segmentStart + charactersPerLine)
		);
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
			// Advance the synthetic anchor so consecutive atomic blocks (e.g. several images in a
			// row) get distinct [anchor, anchor+1) ranges; otherwise they collide and saved
			// progress can only ever resolve to the first such page.
			state.lastLinearTextEnd += 1;
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
	if (!pages.length) {
		return 0;
	}
	// Prefer an exact half-open range match. Otherwise fall back to the last page that starts
	// at or before the position, so a position landing in a gap between page ranges maps to the
	// nearest preceding page rather than jumping to the final page.
	let candidateIndex = 0;
	for (const readerPage of pages) {
		if (position >= readerPage.start && position < readerPage.end) {
			return readerPage.index;
		}
		if (readerPage.start <= position) {
			candidateIndex = readerPage.index;
		}
	}
	return candidateIndex;
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

// --- Reflowable HTML layout (theme application & page measurement) ---

export interface ReflowableLayoutMetrics {
	columnWidth: number;
	columnGap: number;
	pageWidth: number;
	pageHeight: number;
	pageCount: number;
}

export function applyReaderTheme(element: HTMLElement, settings: ReaderThemeSettings): void {
	element.style.setProperty('--reader-background-color', settings.backgroundColor);
	element.style.setProperty('--reader-text-color', settings.textColor);
	element.style.setProperty('--reader-link-color', settings.linkColor);
	element.style.setProperty(
		'--reader-selection-background-color',
		settings.selectionBackgroundColor
	);
	element.style.setProperty('--reader-selection-text-color', settings.selectionTextColor);
	element.style.setProperty('--reader-font-family', settings.fontFamily);
	element.style.setProperty('--reader-font-size', `${settings.fontSizePercent}%`);
	element.style.setProperty('--reader-line-height', `${settings.lineHeight}`);
	element.style.setProperty('--reader-margin-scale', `${settings.marginScale}`);
	element.style.setProperty('--reader-column-count', `${settings.columnCount}`);
	element.style.setProperty('--reader-writing-mode', settings.writingMode);
}

export function measureReflowableLayout(element: HTMLElement): ReflowableLayoutMetrics {
	const rect = element.getBoundingClientRect();
	const styles = getComputedStyle(element);
	const columnGap = Number.parseFloat(styles.columnGap) || 0;
	const scrollWidth = element.scrollWidth;
	const pageWidth = Math.max(1, rect.width);
	const pageHeight = Math.max(1, rect.height);
	const pageCount = Math.max(1, Math.ceil(scrollWidth / Math.max(1, pageWidth + columnGap)));

	return {
		columnWidth: pageWidth,
		columnGap,
		pageWidth,
		pageHeight,
		pageCount,
	};
}

export function scrollToReflowablePage(element: HTMLElement, pageIndex: number): void {
	const metrics = measureReflowableLayout(element);
	element.scrollLeft = pageIndex * (metrics.pageWidth + metrics.columnGap);
}

export function createLocatorFromReflowablePosition(
	resourceHref: string,
	element: HTMLElement
): NormalizedReaderLocator {
	const metrics = measureReflowableLayout(element);
	const progression = metrics.pageCount > 1 ? element.scrollLeft / element.scrollWidth : 0;
	return {
		type: 'reflowable',
		resourceHref,
		progression: Math.min(1, Math.max(0, progression)),
		updatedAt: new Date().toISOString(),
	};
}

export function restoreReflowableLocator(
	element: HTMLElement,
	locator: NormalizedReaderLocator
): void {
	if (locator.type !== 'reflowable') {
		return;
	}
	const metrics = measureReflowableLayout(element);
	const pageIndex = Math.round(locator.progression * Math.max(0, metrics.pageCount - 1));
	scrollToReflowablePage(element, pageIndex);
}

// --- Page snapshots (canvas rendering for page-curl animation) ---

interface SnapshotTextStyle {
	fontFamily: string;
	fontSize: number;
	fontWeight: string;
	lineHeight: number;
	color: string;
}

interface SnapshotPageStyle {
	width: number;
	height: number;
	paddingTop: number;
	paddingRight: number;
	paddingBottom: number;
	paddingLeft: number;
	backgroundColor: string;
	body: SnapshotTextStyle;
	heading: SnapshotTextStyle;
	bodyGap: number;
	headingGap: number;
	devicePixelRatio: number;
}

export interface ReaderPageSnapshot {
	source: HTMLCanvasElement;
	width: number;
	height: number;
}

const FALLBACK_BACKGROUND_COLOR = '#ffffff';
const FALLBACK_TEXT_COLOR = '#171717';
const FALLBACK_FONT_SIZE = 20;
const BODY_GAP_EM = 1.4;
const HEADING_GAP_EM = 1.4;
const HEADING_FONT_SCALE = 1.35;
const HEADING_LINE_HEIGHT = 1.5;
const SNAPSHOT_PIXEL_RATIO_LIMIT = 2;

function parsePixelValue(value: string, fallback: number): number {
	const parsedValue = Number.parseFloat(value);
	return Number.isFinite(parsedValue) ? parsedValue : fallback;
}

function resolveCanvasColor(value: string, fallback: string): string {
	return value && value !== 'rgba(0, 0, 0, 0)' && value !== 'transparent' ? value : fallback;
}

function createTextStyle(
	styles: CSSStyleDeclaration,
	fontSize: number,
	lineHeight: number,
	color: string,
	fontWeight = styles.fontWeight
): SnapshotTextStyle {
	return {
		fontFamily: styles.fontFamily,
		fontSize,
		fontWeight,
		lineHeight,
		color,
	};
}

function readSnapshotPageStyle(pageElement: HTMLElement): SnapshotPageStyle {
	const styles = getComputedStyle(pageElement);
	const rect = pageElement.getBoundingClientRect();
	const fontSize = parsePixelValue(styles.fontSize, FALLBACK_FONT_SIZE);
	const lineHeight = parsePixelValue(styles.lineHeight, fontSize * 2);
	const textColor = resolveCanvasColor(styles.color, FALLBACK_TEXT_COLOR);
	const headingFontSize = fontSize * HEADING_FONT_SCALE;

	return {
		width: Math.max(1, Math.round(rect.width)),
		height: Math.max(1, Math.round(rect.height)),
		paddingTop: parsePixelValue(styles.paddingTop, 0),
		paddingRight: parsePixelValue(styles.paddingRight, 0),
		paddingBottom: parsePixelValue(styles.paddingBottom, 0),
		paddingLeft: parsePixelValue(styles.paddingLeft, 0),
		backgroundColor: resolveCanvasColor(styles.backgroundColor, FALLBACK_BACKGROUND_COLOR),
		body: createTextStyle(styles, fontSize, lineHeight, textColor),
		heading: createTextStyle(
			styles,
			headingFontSize,
			headingFontSize * HEADING_LINE_HEIGHT,
			textColor,
			'600'
		),
		bodyGap: fontSize * BODY_GAP_EM,
		headingGap: fontSize * HEADING_GAP_EM,
		devicePixelRatio: Math.min(window.devicePixelRatio || 1, SNAPSHOT_PIXEL_RATIO_LIMIT),
	};
}

function setCanvasFont(context: CanvasRenderingContext2D, style: SnapshotTextStyle): void {
	context.font = `${style.fontWeight} ${style.fontSize}px ${style.fontFamily}`;
	context.fillStyle = style.color;
	context.textBaseline = 'top';
}

function wrapText(context: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
	const lines: string[] = [];
	for (const paragraph of text.split('\n')) {
		let currentLine = '';
		for (const character of Array.from(paragraph)) {
			const nextLine = `${currentLine}${character}`;
			if (currentLine && context.measureText(nextLine).width > maxWidth) {
				lines.push(currentLine);
				currentLine = character;
			} else {
				currentLine = nextLine;
			}
		}
		lines.push(currentLine);
	}
	return lines;
}

function drawPageText(
	context: CanvasRenderingContext2D,
	page: ReaderPage,
	style: SnapshotPageStyle
): void {
	const contentWidth = style.width - style.paddingLeft - style.paddingRight;
	const contentBottom = style.height - style.paddingBottom;
	let cursorY = style.paddingTop;

	for (const block of page.blocks) {
		const textStyle = block.kind === 'heading' ? style.heading : style.body;
		const blockGap = block.kind === 'heading' ? style.headingGap : style.bodyGap;
		setCanvasFont(context, textStyle);

		const halfLeading = (textStyle.lineHeight - textStyle.fontSize) / 2;
		for (const line of wrapText(context, block.text, contentWidth)) {
			if (cursorY + textStyle.lineHeight > contentBottom) {
				return;
			}
			context.fillText(line, style.paddingLeft, cursorY + halfLeading);
			cursorY += textStyle.lineHeight;
		}

		cursorY += blockGap;
	}
}

export function createReaderPageSnapshot(
	page: ReaderPage,
	pageElement: HTMLElement
): ReaderPageSnapshot {
	const style = readSnapshotPageStyle(pageElement);
	const canvas = document.createElement('canvas');
	const context = canvas.getContext('2d');
	if (!context) {
		throw new Error('Could not create reader page snapshot.');
	}

	canvas.width = Math.round(style.width * style.devicePixelRatio);
	canvas.height = Math.round(style.height * style.devicePixelRatio);
	canvas.style.width = `${style.width}px`;
	canvas.style.height = `${style.height}px`;
	context.scale(style.devicePixelRatio, style.devicePixelRatio);
	context.fillStyle = style.backgroundColor;
	context.fillRect(0, 0, style.width, style.height);
	drawPageText(context, page, style);

	return {
		source: canvas,
		width: style.width,
		height: style.height,
	};
}
