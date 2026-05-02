import type { ReaderThemeSettings } from '@/reader/types.js';

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
