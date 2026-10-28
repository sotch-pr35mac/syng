import type { ReaderSegment } from '@/utils/readerPagination.js';

export const READER_PINYIN_SCALE = 0.65;
export const READER_ANNOTATION_LINE_HEIGHT = 1.2;
const ANNOTATED_BASE_LINE_HEIGHT = 1.2;
const LATIN_EXTENDED_END = 0x024f;
const FALLBACK_LATIN_WIDTH = 0.6;
const WIDTH_EPSILON = 0.01;
const DEFAULT_ROOT_FONT_SIZE = 16;
const CSS_PIXELS_PER_INCH = 96;
const POINTS_PER_INCH = 72;
const CSS_PIXELS_PER_POINT = CSS_PIXELS_PER_INCH / POINTS_PER_INCH;
export interface ReaderTextRun extends ReaderSegment {
	width: number;
	baseHeight: number;
	annotationHeight: number;
	wrapAnnotation: boolean;
}
export interface ReaderTextLine {
	metrics: ReaderTextMetrics;
	start: number;
	end: number;
	height: number;
	above: number;
	indent?: number;
	runs: ReaderTextRun[];
}
export interface ReaderTextMetrics {
	width: number;
	fontSize: number;
	lineHeight: number;
	fontFamily: string;
	fontWeight?: string;
	/** Resolved first-line indentation in CSS pixels. */
	textIndent?: number;
}

export function resolveReaderTextIndent(
	value: string | undefined,
	fontSize: number,
	width: number
): number {
	const match = value?.trim().match(/^(-?[\d.]+)(px|em|rem|%|pt)?$/);
	if (!match) {
		return 0;
	}
	const amount = Number(match[1]);
	const scale =
		match[2] === 'em'
			? fontSize
			: match[2] === 'rem'
				? DEFAULT_ROOT_FONT_SIZE
				: match[2] === '%'
					? width / 100
					: match[2] === 'pt'
						? CSS_PIXELS_PER_POINT
						: 1;
	return Number.isFinite(amount) ? amount * scale : 0;
}

let context: CanvasRenderingContext2D | null | undefined;
export function measureReaderText(
	text: string,
	metrics: ReaderTextMetrics,
	annotation = false
): number {
	if (context === undefined) {
		context =
			typeof CanvasRenderingContext2D === 'undefined'
				? null
				: document.createElement('canvas').getContext('2d');
	}
	const size = metrics.fontSize * (annotation ? READER_PINYIN_SCALE : 1);
	if (context) {
		context.font = `${annotation ? '400' : (metrics.fontWeight ?? '400')} ${size}px ${metrics.fontFamily}`;
		return context.measureText(text).width;
	}
	// Deterministic fallback for non-rendering runtimes; browsers use their actual font metrics.
	return Array.from(text).reduce(
		(width, character) =>
			width +
			size * (character.codePointAt(0)! > LATIN_EXTENDED_END ? 1 : FALLBACK_LATIN_WIDTH),
		0
	);
}

/** One layout feeds pagination, the visible text, and page-turn snapshots. */
export function layoutReaderText(
	segments: ReaderSegment[],
	metrics: ReaderTextMetrics
): ReaderTextLine[] {
	const lines: ReaderTextLine[] = [];
	let runs: ReaderTextRun[] = [];
	let usedWidth = 0;
	let indent = Math.min(metrics.textIndent ?? 0, Math.max(0, metrics.width - 1));
	let cursor = 0;
	let lineStart = 0;
	const width = Math.max(1, metrics.width);
	// Put annotations into the existing line leading before adding more height.
	// Using the full Reader line-height for the characters and adding pinyin below
	// it would charge for that whitespace twice.
	const baseLineHeight = Math.min(
		metrics.lineHeight,
		metrics.fontSize * ANNOTATED_BASE_LINE_HEIGHT
	);
	function flush(): void {
		if (!runs.length) {
			return;
		}
		const above = Math.max(
			0,
			...runs.map((run) => (run.annotationSource === 'imported' ? run.annotationHeight : 0))
		);
		const below = Math.max(
			0,
			...runs.map((run) => (run.annotationSource === 'generated' ? run.annotationHeight : 0))
		);
		lines.push({
			metrics: { ...metrics, lineHeight: baseLineHeight },
			start: lineStart,
			end: cursor,
			height: Math.max(
				metrics.lineHeight,
				above + Math.max(baseLineHeight, ...runs.map((run) => run.baseHeight)) + below
			),
			above,
			indent,
			runs,
		});
		runs = [];
		usedWidth = 0;
		indent = 0;
		lineStart = cursor;
	}
	for (const segment of segments) {
		const pieces = segment.annotation ? [segment.text] : Array.from(segment.text);
		for (const text of pieces) {
			const baseWidth = measureReaderText(text.replace(/\n/g, ''), metrics);
			const annotationWidth = segment.annotation
				? measureReaderText(segment.annotation, metrics, true)
				: 0;
			const naturalWidth = segment.annotation
				? Math.ceil(Math.max(baseWidth, annotationWidth)) + 1
				: baseWidth;
			if (runs.length && usedWidth + naturalWidth > width - indent + WIDTH_EPSILON) {
				flush();
			}
			const availableWidth = width - indent;
			const runWidth = Math.min(
				availableWidth,
				segment.annotation ? Math.ceil(Math.max(baseWidth, annotationWidth)) + 1 : baseWidth
			);
			const baseHeight = Math.max(1, Math.ceil(baseWidth / availableWidth)) * baseLineHeight;
			const annotationHeight = segment.annotation
				? Math.max(1, Math.ceil(annotationWidth / availableWidth)) *
					metrics.fontSize *
					READER_PINYIN_SCALE *
					READER_ANNOTATION_LINE_HEIGHT
				: 0;
			const previous = runs.at(-1);
			if (
				!segment.annotation &&
				previous &&
				!previous.annotation &&
				previous.token === segment.token &&
				text !== '\n'
			) {
				previous.text += text;
				previous.width += runWidth;
			} else {
				runs.push({
					...segment,
					text,
					width: runWidth,
					baseHeight,
					annotationHeight,
					wrapAnnotation: annotationWidth > availableWidth,
				});
			}
			usedWidth += runWidth;
			cursor += text.length;
			if (text === '\n') {
				flush();
			}
		}
	}
	flush();
	return lines;
}
