import { openReaderPublication } from '@/reader/publication/index.js';
import { configurePdfJsWorker, getPdfJsDocumentInitOptions } from '@/reader/pdfjsWorker.js';
import type {
	ReaderContentBlock,
	ReaderImportPayload,
	ReaderInlineSpan,
} from '@/types/reader.js';
import { buildReaderDocumentFromHtmlParts } from '@/utils/readerHtmlToCanonical.js';
import { extractReaderBlocksFromPlainText } from '@/utils/readerPlainTextImport.js';

// ---------------------------------------------------------------------------
// PDF structured extraction types
// ---------------------------------------------------------------------------

interface PdfTextRun {
	text: string;
	fontSize: number;
	xPosition: number;
	yPosition: number;
	fontFamily: string;
	bold: boolean;
	italic: boolean;
	endOfLine: boolean;
}

interface PdfLine {
	runs: PdfTextRun[];
	text: string;
	yPosition: number;
	dominantFontSize: number;
	indentation: number;
	allBold: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateBlockId(): string {
	if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
		return crypto.randomUUID();
	}
	return `block-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

type PdfPage = Awaited<ReturnType<import('pdfjs-dist').PDFDocumentProxy['getPage']>>;

async function collectPageTextContent(
	page: PdfPage
): Promise<{ items: unknown[]; styles: Record<string, unknown> }> {
	const stream = page.streamTextContent();
	const reader = stream.getReader();
	const allItems: unknown[] = [];
	const allStyles: Record<string, unknown> = Object.create(null);
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		const chunk = value as
			| { items?: unknown[]; styles?: Record<string, unknown> }
			| undefined;
		if (Array.isArray(chunk?.items)) {
			allItems.push(...chunk.items);
		}
		if (chunk?.styles && typeof chunk.styles === 'object') {
			Object.assign(allStyles, chunk.styles);
		}
	}
	return { items: allItems, styles: allStyles };
}

// ---------------------------------------------------------------------------
// Font style detection
// ---------------------------------------------------------------------------

const BOLD_PATTERN = /\bbold|black|heavy|semibold|demibold|extrabold|ultrabold/i;
const ITALIC_PATTERN = /\bitalic|oblique/i;

function detectFontTraits(fontFamily: string): { bold: boolean; italic: boolean } {
	return {
		bold: BOLD_PATTERN.test(fontFamily),
		italic: ITALIC_PATTERN.test(fontFamily),
	};
}

function lookupFontFamily(
	fontName: string,
	styles: Record<string, unknown>
): string {
	const entry = styles[fontName];
	if (entry && typeof entry === 'object' && 'fontFamily' in entry) {
		return String((entry as { fontFamily: unknown }).fontFamily);
	}
	return fontName;
}

// ---------------------------------------------------------------------------
// Build text runs from raw pdf.js items
// ---------------------------------------------------------------------------

interface RawTextItem {
	str: string;
	transform: number[];
	fontName: string;
	hasEOL: boolean;
	width: number;
	height: number;
}

function isTextItem(item: unknown): item is RawTextItem {
	if (!item || typeof item !== 'object') return false;
	const record = item as Record<string, unknown>;
	return typeof record.str === 'string' && Array.isArray(record.transform);
}

function buildTextRuns(
	items: unknown[],
	styles: Record<string, unknown>
): PdfTextRun[] {
	const runs: PdfTextRun[] = [];
	for (const item of items) {
		if (!isTextItem(item)) continue;
		if (item.str.length === 0 && !item.hasEOL) continue;
		const transform = item.transform;
		const fontSize = Math.abs(transform[3]) || Math.hypot(transform[0], transform[1]) || 12;
		const fontFamily = lookupFontFamily(item.fontName, styles);
		const traits = detectFontTraits(fontFamily);
		runs.push({
			text: item.str,
			fontSize: Math.round(fontSize * 100) / 100,
			xPosition: transform[4],
			yPosition: transform[5],
			fontFamily,
			bold: traits.bold,
			italic: traits.italic,
			endOfLine: item.hasEOL,
		});
	}
	return runs;
}

// ---------------------------------------------------------------------------
// Group runs into lines
// ---------------------------------------------------------------------------

function dominantValue(values: number[]): number {
	if (values.length === 0) return 0;
	const counts = new Map<number, number>();
	for (const value of values) {
		counts.set(value, (counts.get(value) ?? 0) + 1);
	}
	let best = values[0];
	let bestCount = 0;
	for (const [value, count] of counts) {
		if (count > bestCount) {
			best = value;
			bestCount = count;
		}
	}
	return best;
}

function groupRunsIntoLines(runs: PdfTextRun[]): PdfLine[] {
	if (runs.length === 0) return [];
	const lines: PdfLine[] = [];
	let currentRuns: PdfTextRun[] = [];

	function flushLine(): void {
		if (currentRuns.length === 0) return;
		const lineText = currentRuns.map((run) => run.text).join('');
		if (lineText.trim().length === 0) {
			currentRuns = [];
			return;
		}
		const fontSizes = currentRuns.map((run) => run.fontSize);
		const everyBold = currentRuns.every((run) => run.bold || run.text.trim().length === 0);
		lines.push({
			runs: currentRuns,
			text: lineText,
			yPosition: currentRuns[0].yPosition,
			dominantFontSize: dominantValue(fontSizes),
			indentation: currentRuns[0].xPosition,
			allBold: everyBold,
		});
		currentRuns = [];
	}

	for (const run of runs) {
		currentRuns.push(run);
		if (run.endOfLine) {
			flushLine();
		}
	}
	flushLine();
	return lines;
}

// ---------------------------------------------------------------------------
// Group lines into blocks based on vertical spacing
// ---------------------------------------------------------------------------

function computeLineGaps(lines: PdfLine[]): number[] {
	const gaps: number[] = [];
	for (let index = 1; index < lines.length; index += 1) {
		const gap = Math.abs(lines[index - 1].yPosition - lines[index].yPosition);
		if (gap > 0) {
			gaps.push(gap);
		}
	}
	return gaps;
}

function medianValue(values: number[]): number {
	if (values.length === 0) return 0;
	const sorted = [...values].sort((left, right) => left - right);
	const mid = Math.floor(sorted.length / 2);
	return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

const PARAGRAPH_GAP_FACTOR = 1.4;
const FONT_SIZE_CHANGE_THRESHOLD = 1.15;

interface PdfRawBlock {
	lines: PdfLine[];
}

function groupLinesIntoBlocks(lines: PdfLine[]): PdfRawBlock[] {
	if (lines.length === 0) return [];

	const gaps = computeLineGaps(lines);
	const medianGap = medianValue(gaps);
	const paragraphGapThreshold =
		medianGap > 0 ? medianGap * PARAGRAPH_GAP_FACTOR : Infinity;

	const blocks: PdfRawBlock[] = [];
	let currentLines: PdfLine[] = [lines[0]];

	for (let index = 1; index < lines.length; index += 1) {
		const previousLine = lines[index - 1];
		const currentLine = lines[index];
		const gap = Math.abs(previousLine.yPosition - currentLine.yPosition);

		const fontSizeRatio =
			previousLine.dominantFontSize > 0
				? currentLine.dominantFontSize / previousLine.dominantFontSize
				: 1;
		const fontSizeChanged =
			fontSizeRatio > FONT_SIZE_CHANGE_THRESHOLD ||
			fontSizeRatio < 1 / FONT_SIZE_CHANGE_THRESHOLD;

		const isLargeGap = medianGap > 0 && gap > paragraphGapThreshold;

		if (isLargeGap || fontSizeChanged) {
			blocks.push({ lines: currentLines });
			currentLines = [currentLine];
		} else {
			currentLines.push(currentLine);
		}
	}

	if (currentLines.length > 0) {
		blocks.push({ lines: currentLines });
	}

	return blocks;
}

// ---------------------------------------------------------------------------
// Detect body (most common) font size across all runs
// ---------------------------------------------------------------------------

function detectBodyFontSize(allRuns: PdfTextRun[]): number {
	const charCountBySize = new Map<number, number>();
	for (const run of allRuns) {
		const charCount = run.text.length;
		if (charCount === 0) continue;
		const roundedSize = Math.round(run.fontSize * 10) / 10;
		charCountBySize.set(roundedSize, (charCountBySize.get(roundedSize) ?? 0) + charCount);
	}
	let bodySize = 12;
	let maxChars = 0;
	for (const [size, count] of charCountBySize) {
		if (count > maxChars) {
			bodySize = size;
			maxChars = count;
		}
	}
	return bodySize;
}

// ---------------------------------------------------------------------------
// Classify blocks and build canonical ReaderContentBlocks
// ---------------------------------------------------------------------------

const HEADING_SIZE_THRESHOLDS: Array<{ minRatio: number; level: 1 | 2 | 3 | 4 | 5 | 6 }> = [
	{ minRatio: 1.8, level: 1 },
	{ minRatio: 1.5, level: 2 },
	{ minRatio: 1.3, level: 3 },
	{ minRatio: 1.15, level: 4 },
];

const HEADING_MAX_LINES = 4;
const HEADING_MAX_CHARS = 200;

const BULLET_PATTERN = /^[•‣◦⁃∙▪▫●○–—•●○◦–—\-\*]\s+/;
const ORDERED_LIST_PATTERN = /^(?:\d{1,3}[.)]\s+|[a-z][.)]\s+|[ivxlc]+[.)]\s+)/i;

function classifyBlock(
	rawBlock: PdfRawBlock,
	bodyFontSize: number
): {
	kind: string;
	headingLevel?: 1 | 2 | 3 | 4 | 5 | 6;
	listStyle?: 'bullet' | 'ordered';
} {
	const blockFontSize = dominantValue(rawBlock.lines.map((line) => line.dominantFontSize));
	const sizeRatio = bodyFontSize > 0 ? blockFontSize / bodyFontSize : 1;
	const totalChars = rawBlock.lines.reduce((sum, line) => sum + line.text.length, 0);
	const lineCount = rawBlock.lines.length;
	const allLinesBold = rawBlock.lines.every((line) => line.allBold);

	if (
		sizeRatio >= HEADING_SIZE_THRESHOLDS[HEADING_SIZE_THRESHOLDS.length - 1].minRatio &&
		lineCount <= HEADING_MAX_LINES &&
		totalChars <= HEADING_MAX_CHARS
	) {
		for (const threshold of HEADING_SIZE_THRESHOLDS) {
			if (sizeRatio >= threshold.minRatio) {
				return { kind: 'heading', headingLevel: threshold.level };
			}
		}
	}

	if (
		allLinesBold &&
		lineCount <= 2 &&
		totalChars <= HEADING_MAX_CHARS &&
		sizeRatio >= 0.98
	) {
		return { kind: 'heading', headingLevel: 5 };
	}

	if (lineCount === 1) {
		const trimmedText = rawBlock.lines[0].text.trim();
		if (BULLET_PATTERN.test(trimmedText)) {
			return { kind: 'list_item', listStyle: 'bullet' };
		}
		if (ORDERED_LIST_PATTERN.test(trimmedText)) {
			return { kind: 'list_item', listStyle: 'ordered' };
		}
	}

	return { kind: 'paragraph' };
}

function buildInlineSpans(lines: PdfLine[], blockText: string): ReaderInlineSpan[] {
	const spans: ReaderInlineSpan[] = [];
	let offset = 0;

	for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
		if (lineIndex > 0) {
			offset += 1;
		}
		for (const run of lines[lineIndex].runs) {
			const runLength = run.text.length;
			if (runLength === 0) continue;
			if (run.bold) {
				spans.push({ start: offset, end: offset + runLength, style: 'strong' });
			}
			if (run.italic) {
				spans.push({ start: offset, end: offset + runLength, style: 'emphasis' });
			}
			offset += runLength;
		}
	}

	return mergeAdjacentSpans(spans, blockText.length);
}

function mergeAdjacentSpans(spans: ReaderInlineSpan[], textLength: number): ReaderInlineSpan[] {
	if (spans.length === 0) return [];
	const byStyle = new Map<string, ReaderInlineSpan[]>();
	for (const span of spans) {
		const existing = byStyle.get(span.style) ?? [];
		existing.push(span);
		byStyle.set(span.style, existing);
	}
	const merged: ReaderInlineSpan[] = [];
	for (const [style, styleSpans] of byStyle) {
		styleSpans.sort((left, right) => left.start - right.start);
		let current = { ...styleSpans[0] };
		for (let index = 1; index < styleSpans.length; index += 1) {
			const next = styleSpans[index];
			if (next.start <= current.end + 1) {
				current.end = Math.max(current.end, next.end);
			} else {
				if (current.end <= textLength) merged.push(current);
				current = { ...next };
			}
		}
		if (current.end <= textLength) merged.push(current);
	}
	merged.sort((left, right) => left.start - right.start || left.end - right.end);
	return merged;
}

// ---------------------------------------------------------------------------
// Assign linear text offsets to blocks (same pattern as HTML importer)
// ---------------------------------------------------------------------------

function assignLinearOffsets(blocks: ReaderContentBlock[]): string {
	let documentText = '';
	for (const block of blocks) {
		if (block.participates_in_linear_text === false) continue;
		const prefix = documentText.length > 0 ? '\n' : '';
		const startOffset = documentText.length + prefix.length;
		documentText += prefix + block.text;
		block.start_offset = startOffset;
		block.end_offset = documentText.length;
	}
	return documentText;
}

// ---------------------------------------------------------------------------
// Main structured PDF extraction
// ---------------------------------------------------------------------------

async function extractPdfStructuredContent(data: Uint8Array): Promise<{
	text: string;
	blocks: ReaderContentBlock[];
}> {
	const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist');
	configurePdfJsWorker(GlobalWorkerOptions);

	const copy = new Uint8Array(data.byteLength);
	copy.set(data);
	const pdf = await getDocument({
		data: copy.buffer,
		...getPdfJsDocumentInitOptions(),
	}).promise;

	const allRuns: PdfTextRun[] = [];
	const pageRunRanges: Array<{ start: number; end: number }> = [];

	for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
		const page = await pdf.getPage(pageNumber);
		const { items, styles } = await collectPageTextContent(page);
		const rangeStart = allRuns.length;
		const pageRuns = buildTextRuns(items, styles);
		allRuns.push(...pageRuns);
		pageRunRanges.push({ start: rangeStart, end: allRuns.length });
	}

	await pdf.destroy();

	if (allRuns.length === 0) {
		return { text: '', blocks: [] };
	}

	const bodyFontSize = detectBodyFontSize(allRuns);
	const canonicalBlocks: ReaderContentBlock[] = [];
	let activeBulletListId: string | undefined;
	let activeOrderedListId: string | undefined;
	let orderedOrdinal = 0;

	for (const range of pageRunRanges) {
		const pageRuns = allRuns.slice(range.start, range.end);
		if (pageRuns.length === 0) continue;

		const lines = groupRunsIntoLines(pageRuns);
		const rawBlocks = groupLinesIntoBlocks(lines);

		for (const rawBlock of rawBlocks) {
			const classification = classifyBlock(rawBlock, bodyFontSize);
			const blockText = rawBlock.lines.map((line) => line.text.trim()).join('\n');
			if (blockText.trim().length === 0) continue;

			if (classification.kind !== 'list_item') {
				activeBulletListId = undefined;
				activeOrderedListId = undefined;
				orderedOrdinal = 0;
			}

			const inlineSpans = buildInlineSpans(rawBlock.lines, blockText);
			const spansToInclude = inlineSpans.length > 0 ? inlineSpans : undefined;

			if (classification.kind === 'heading') {
				canonicalBlocks.push({
					id: generateBlockId(),
					kind: 'heading',
					text: blockText,
					participates_in_linear_text: true,
					heading_level: classification.headingLevel,
					spans: spansToInclude,
				});
			} else if (classification.kind === 'list_item') {
				const isBullet = classification.listStyle === 'bullet';
				if (isBullet) {
					activeBulletListId ??= generateBlockId();
					activeOrderedListId = undefined;
					orderedOrdinal = 0;
				} else {
					activeOrderedListId ??= generateBlockId();
					activeBulletListId = undefined;
					orderedOrdinal += 1;
				}
				canonicalBlocks.push({
					id: generateBlockId(),
					kind: 'list_item',
					text: blockText,
					participates_in_linear_text: true,
					spans: spansToInclude,
					extensions: {
						list_item: {
							list_id: isBullet ? activeBulletListId! : activeOrderedListId!,
							nesting_depth: 0,
							list_style: isBullet ? 'bullet' : 'ordered',
							ordinal: isBullet ? undefined : orderedOrdinal,
						},
					},
				});
			} else {
				canonicalBlocks.push({
					id: generateBlockId(),
					kind: 'paragraph',
					text: blockText,
					participates_in_linear_text: true,
					spans: spansToInclude,
				});
			}
		}
	}

	const text = assignLinearOffsets(canonicalBlocks);
	return { text, blocks: canonicalBlocks };
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
	if (typeof crypto === 'undefined' || !crypto.subtle) {
		return '';
	}
	const hashInput = new Uint8Array(bytes.byteLength);
	hashInput.set(bytes);
	const digest = await crypto.subtle.digest('SHA-256', hashInput);
	return Array.from(new Uint8Array(digest))
		.map((byte) => byte.toString(16).padStart(2, '0'))
		.join('');
}

export async function buildCanonicalImportFromPublication(options: {
	fileName: string;
	mimeType: string;
	sourceType: string;
	data: Uint8Array;
	fallbackTitle: string;
}): Promise<ReaderImportPayload> {
	const publication = await openReaderPublication({
		id: `preview:${options.fileName}`,
		fileName: options.fileName,
		mimeType: options.mimeType,
		data: options.data,
	});

	const title = publication.metadata.title || options.fallbackTitle;
	const sourceSha256 = await sha256Hex(options.data);

	let text: string;
	let blocks: ReaderContentBlock[];

	if (publication.format === 'pdf') {
		const structured = await extractPdfStructuredContent(options.data);
		text = structured.text.trim() || title;
		blocks =
			structured.blocks.length > 0
				? structured.blocks
				: extractReaderBlocksFromPlainText(text);
	} else {
		const htmlParts: string[] = [];
		const textFallback: string[] = [];
		for (const item of publication.readingOrder) {
			const resource = publication.resources.find(
				(resourceItem) => resourceItem.href === item.href
			);
			if (resource?.html) {
				htmlParts.push(resource.html);
			} else {
				const plain = (resource?.text ?? '').trim();
				if (plain) {
					textFallback.push(plain);
				}
			}
		}

		if (htmlParts.length > 0) {
			const built = buildReaderDocumentFromHtmlParts(htmlParts);
			text = built.text.trim() || title;
			blocks = built.blocks.length > 0 ? built.blocks : extractReaderBlocksFromPlainText(text);
		} else {
			const combinedPlain = textFallback.filter(Boolean).join('\n\n');
			text = combinedPlain.trim() || title;
			blocks = extractReaderBlocksFromPlainText(text);
		}
	}

	return {
		canonical_schema_version: 1,
		title,
		file_name: options.fileName,
		source_type: options.sourceType,
		mime_type: options.mimeType,
		extractor_version: publication.source.extractorVersion,
		text,
		blocks,
		source_data: options.data,
		source_sha256: sourceSha256 || undefined,
		source_byte_length: options.data.byteLength,
	};
}
