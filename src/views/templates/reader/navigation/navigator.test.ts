import { expect, it } from 'vitest';
import { ReaderNavigator } from '@/reader/navigation/navigator.js';
import type { ReaderPublication } from '@/reader/types.js';

const publication: ReaderPublication = {
	id: 'publication-1',
	format: 'text',
	metadata: { title: 'Story' },
	source: {
		id: 'source-1',
		format: 'text',
		importedAt: '2026-01-01T00:00:00.000Z',
		extractorVersion: 1,
	},
	readingOrder: [
		{ href: 'chapter-1', type: 'text/html' },
		{ href: 'chapter-2', type: 'text/html' },
	],
	resources: [
		{ href: 'chapter-1', type: 'text/html', kind: 'reflowable-document', html: '<p>一</p>' },
		{ href: 'chapter-2', type: 'text/html', kind: 'reflowable-document', html: '<p>二</p>' },
	],
	capabilities: {
		reflowable: true,
		fixedLayout: false,
		hasTextLayer: true,
		supportsDictionaryLookup: true,
		supportsThemes: true,
		supportsPageCurl: true,
	},
};
const HALF_PROGRESSION = 0.5;

it('navigates through the reading order and creates stable locators', () => {
	const navigator = new ReaderNavigator(publication);

	expect(navigator.state.resource.href).toBe('chapter-1');
	expect(navigator.state.canGoBackward).toBe(false);
	expect(navigator.goForward().resource.href).toBe('chapter-2');
	expect(navigator.state.canGoForward).toBe(false);

	const locator = navigator.createLocator(HALF_PROGRESSION);
	expect(locator.type).toBe('reflowable');
	expect(locator.resourceHref).toBe('chapter-2');
	expect(locator.progression).toBe(HALF_PROGRESSION);
});

it('restores the closest resource from an existing locator', () => {
	const navigator = new ReaderNavigator(publication, {
		type: 'reflowable',
		resourceHref: 'chapter-2',
		progression: 0.2,
		updatedAt: '2026-01-01T00:00:00.000Z',
	});

	expect(navigator.state.resource.href).toBe('chapter-2');
});
