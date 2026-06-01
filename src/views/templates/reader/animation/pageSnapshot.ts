import type { ReaderPage } from '@/utils/readerPagination.js';

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
