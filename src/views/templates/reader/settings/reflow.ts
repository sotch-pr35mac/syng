import {
	measureReflowableLayout,
	scrollToReflowablePage,
} from '@/reader/layout/reflowableLayout.js';
import type { ReaderLocator } from '@/reader/types.js';

export function createLocatorFromReflowablePosition(
	resourceHref: string,
	element: HTMLElement
): ReaderLocator {
	const metrics = measureReflowableLayout(element);
	const progression = metrics.pageCount > 1 ? element.scrollLeft / element.scrollWidth : 0;
	return {
		type: 'reflowable',
		resourceHref,
		progression: Math.min(1, Math.max(0, progression)),
		updatedAt: new Date().toISOString(),
	};
}

export function restoreReflowableLocator(element: HTMLElement, locator: ReaderLocator): void {
	if (locator.type !== 'reflowable') {
		return;
	}
	const metrics = measureReflowableLayout(element);
	const pageIndex = Math.round(locator.progression * Math.max(0, metrics.pageCount - 1));
	scrollToReflowablePage(element, pageIndex);
}
