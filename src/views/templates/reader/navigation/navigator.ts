import type { ReaderLocator, ReaderPublication, ReaderReadingOrderItem } from '@/reader/types.js';

export interface ReaderNavigationState {
	resourceIndex: number;
	resource: ReaderReadingOrderItem;
	locator: ReaderLocator;
	canGoBackward: boolean;
	canGoForward: boolean;
}

export class ReaderNavigator {
	readonly publication: ReaderPublication;
	#resourceIndex: number;

	constructor(publication: ReaderPublication, locator?: ReaderLocator) {
		this.publication = publication;
		this.#resourceIndex = this.#resolveInitialResourceIndex(locator);
	}

	get state(): ReaderNavigationState {
		const resource = this.publication.readingOrder[this.#resourceIndex];
		return {
			resourceIndex: this.#resourceIndex,
			resource,
			locator: this.createLocator(0),
			canGoBackward: this.#resourceIndex > 0,
			canGoForward: this.#resourceIndex < this.publication.readingOrder.length - 1,
		};
	}

	goForward(): ReaderNavigationState {
		if (this.#resourceIndex < this.publication.readingOrder.length - 1) {
			this.#resourceIndex += 1;
		}
		return this.state;
	}

	goBackward(): ReaderNavigationState {
		if (this.#resourceIndex > 0) {
			this.#resourceIndex -= 1;
		}
		return this.state;
	}

	goTo(locator: ReaderLocator): ReaderNavigationState {
		if (this.publication.format === 'pdf' && locator.type === 'pdf') {
			this.#resourceIndex = this.#resolvePdfResourceIndex(locator);
		} else {
			this.#resourceIndex = this.#resolveResourceIndex(locator.resourceHref);
		}
		return this.state;
	}

	createLocator(progression: number): ReaderLocator {
		const resource = this.publication.readingOrder[this.#resourceIndex];
		if (this.publication.format === 'pdf') {
			return {
				type: 'pdf',
				resourceHref: resource.href,
				pageIndex: this.#resourceIndex,
				progression,
				updatedAt: new Date().toISOString(),
			};
		}

		return {
			type: 'reflowable',
			resourceHref: resource.href,
			progression,
			updatedAt: new Date().toISOString(),
		};
	}

	#resolvePdfResourceIndex(locator: Extract<ReaderLocator, { type: 'pdf' }>): number {
		const hrefIndex = this.publication.readingOrder.findIndex(
			(item) => item.href === locator.resourceHref
		);
		if (hrefIndex >= 0) {
			return hrefIndex;
		}
		const maxIndex = Math.max(0, this.publication.readingOrder.length - 1);
		const pageIndex = locator.pageIndex;
		if (Number.isFinite(pageIndex)) {
			return Math.max(0, Math.min(Math.floor(pageIndex), maxIndex));
		}
		return 0;
	}

	#resolveInitialResourceIndex(locator?: ReaderLocator): number {
		if (this.publication.format === 'pdf' && locator?.type === 'pdf') {
			return this.#resolvePdfResourceIndex(locator);
		}
		return this.#resolveResourceIndex(locator?.resourceHref);
	}

	#resolveResourceIndex(resourceHref: string | undefined): number {
		if (!resourceHref) {
			return 0;
		}
		const index = this.publication.readingOrder.findIndex((item) => item.href === resourceHref);
		return Math.max(0, index);
	}
}
