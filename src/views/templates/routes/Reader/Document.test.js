import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { invoke } from '@tauri-apps/api/core';
import { mockBookmarkManager, mockPreferenceManager } from '@test/utils/unitTestUtils.js';
import Document from '@/routes/Reader/Document.svelte';
import { readerRoute } from '@/composables/reader.svelte.js';
import * as systemTypography from '@/composables/systemTypography.js';
import { bookmarksStore } from '@/stores/bookmarks.svelte.js';
import {
	setBookmarkManagerForTest,
	setPreferenceManagerForTest,
	setReaderDocumentManagerForTest,
} from '@/utils/appServices.js';

// Every lucide icon resolves to the same inert mock so the reader and its nested
// popovers can render without pulling in the real icon set.
vi.mock('lucide-svelte', async (importOriginal) => {
	const actual = await importOriginal();
	const mockIcon = (await import('@/components/__mocks__/FeatherIcon.svelte')).default;
	return Object.fromEntries(Object.keys(actual).map((iconName) => [iconName, mockIcon]));
});

// Desktop reader runs on the macOS shell (non-iPad), so swipe-to-turn is disabled.
vi.mock('@tauri-apps/plugin-os', () => ({
	platform: () => 'macos',
	version: () => '0.0.0',
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
	ask: vi.fn(() => Promise.resolve(true)),
}));

// The reader tokenizes block text and looks up tapped tokens through the native
// command boundary; both are stubbed here so a tapped token opens the dictionary.
vi.mock('@tauri-apps/api/core', () => ({
	invoke: vi.fn((command, args) => {
		if (command === 'tokenize_reader_text') {
			const text = (args && args.text) || '';
			const tokens = [];
			for (let index = 0; index < text.length; index += 2) {
				tokens.push(text.slice(index, index + 2));
			}
			return Promise.resolve(tokens);
		}
		if (command === 'query_by_chinese') {
			return Promise.resolve([
				{
					word_id: 1,
					hash: 'nihao',
					traditional: '你好',
					simplified: '你好',
					english: ['hello'],
					pinyin_marks: ['nǐ', 'hǎo'],
					tone_marks: [3, 3],
					measure_words: [],
				},
			]);
		}
		return Promise.resolve(null);
	}),
}));

const READER_DOCUMENT = {
	_id: 'reader-1',
	canonical_schema_version: 1,
	title: 'Story',
	file_name: 'story.txt',
	source_type: 'plain_text',
	mime_type: 'text/plain',
	extractor_version: 1,
	color: '#ffffff',
	text: '你好世界',
	blocks: [
		{
			id: 'block-1',
			kind: 'paragraph',
			text: '你好世界',
			start_offset: 0,
			end_offset: 4,
		},
	],
	imported_at: '2026-01-01T00:00:00.000Z',
	updated_at: '2026-01-01T00:00:00.000Z',
	reading_order: [{ href: 'text', type: 'text/plain', title: 'Story' }],
	progress: {
		resource_href: 'text',
		position: 0,
		total_progression: 0,
		page_index: 0,
		text_position: { start: 0, end: 0 },
		text_quote: { exact: '', prefix: '', suffix: '' },
		updated_at: '2026-01-01T00:00:00.000Z',
	},
};

const buildReaderDocumentManager = (overrides = {}) => ({
	waitForInit: vi.fn(() => Promise.resolve()),
	getDocuments: vi.fn(() => Promise.resolve([READER_DOCUMENT])),
	getDocument: vi.fn(() => Promise.resolve(READER_DOCUMENT)),
	createDocument: vi.fn(() => Promise.resolve(READER_DOCUMENT)),
	deleteDocument: vi.fn(() => Promise.resolve()),
	updateProgress: vi.fn(() => Promise.resolve(READER_DOCUMENT)),
	updateMetadata: vi.fn(() => Promise.resolve(READER_DOCUMENT)),
	getSourceData: vi.fn(() => Promise.resolve(new ArrayBuffer(0))),
	getSourceHtml: vi.fn(() => Promise.resolve(undefined)),
	...overrides,
});

function renderReaderDocument(documentId) {
	return render(Document, {
		props: {
			params: documentId ? { id: documentId } : {},
		},
	});
}

beforeEach(async () => {
	// jsdom lacks layout, so stub the browser APIs the reader observes. Spying on
	// setPageLayout keeps the controller from re-paginating against zero-height
	// measurements (which would split the sample paragraph one glyph per page).
	vi.stubGlobal(
		'ResizeObserver',
		class {
			observe() {}
			unobserve() {}
			disconnect() {}
		}
	);
	window.matchMedia = vi.fn().mockReturnValue({
		matches: false,
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
	});
	vi.spyOn(readerRoute, 'setPageLayout').mockResolvedValue(undefined);

	setPreferenceManagerForTest(mockPreferenceManager({}));
	setBookmarkManagerForTest(mockBookmarkManager({ words: [], lists: ['Bookmarks'] }));
	setReaderDocumentManagerForTest(buildReaderDocumentManager());
	await bookmarksStore.refresh();
	window.location.hash = '#/read/document/reader-1';
});

afterEach(() => {
	readerRoute.backToLibrary();
	vi.restoreAllMocks();
});

it('renders the routed document title and tokenized page text', async () => {
	const { findByText } = renderReaderDocument('reader-1');

	expect(await findByText('Story')).toBeTruthy();
	expect(await findByText('你好')).toBeTruthy();
	expect(await findByText('世界')).toBeTruthy();
});

it('opens the dictionary when a token is clicked', async () => {
	const { findByText } = renderReaderDocument('reader-1');

	// fireEvent (not userEvent) because the token is an inline element with no
	// layout box in jsdom, which userEvent's pointer sequence skips.
	await fireEvent.click(await findByText('你好'));

	await waitFor(() => expect(invoke).toHaveBeenCalledWith('query_by_chinese', { text: '你好' }));
});

it('uses a classifier lexical ID when opening a measure word from the dictionary popover', async () => {
	const defaultInvoke = invoke.getMockImplementation();
	const mainWord = {
		word_id: 1,
		hash: 'nihao',
		traditional: '你好',
		simplified: '你好',
		english: [
			{
				gloss: { value: 'hello', sources: ['cc-cedict'] },
				examples: [],
				commentary: [],
				qualifiers: [],
				lexical_kinds: [],
				parts_of_speech: [],
				alternative_pronunciations: [],
				measure_words: [
					{
						value: {
							traditional: '樖',
							simplified: '樖',
							lexical_id: '1:cantonese-measure-word',
							varieties: ['cantonese'],
						},
						sources: ['wiktionary'],
					},
				],
			},
		],
		pinyin: { marks: 'nǐ hǎo', numbers: 'ni3 hao3', tones: [3, 3] },
		measure_words: [],
	};
	const classifierWord = {
		...mainWord,
		word_id: 2,
		hash: 'cantonese-measure-word',
		traditional: '樖',
		simplified: '樖',
		english: ['classifier'],
		measure_words: [],
	};
	invoke.mockClear();
	invoke.mockImplementation((command, args) => {
		if (command === 'query_by_chinese') {
			return Promise.resolve([mainWord]);
		}
		if (command === 'query_by_id' && args?.id === '1:cantonese-measure-word') {
			return Promise.resolve(classifierWord);
		}
		return defaultInvoke(command, args);
	});

	const { findByText, findAllByTestId } = renderReaderDocument('reader-1');
	await fireEvent.click(await findByText('你好'));
	const dictionaryLinks = await findAllByTestId('dictionary-link');
	await fireEvent.click(dictionaryLinks.at(-1));

	await waitFor(() =>
		expect(invoke).toHaveBeenCalledWith('query_by_id', {
			id: '1:cantonese-measure-word',
		})
	);
});

it('adds a reader dictionary word to a selected list from the popup', async () => {
	const user = userEvent.setup();
	const addToList = vi.fn(() => Promise.resolve());
	setBookmarkManagerForTest({
		waitForInit: vi.fn(() => Promise.resolve()),
		getLists: vi.fn(() => Promise.resolve(['Bookmarks', 'Test'])),
		inList: vi.fn(() => Promise.resolve([])),
		getListContent: vi.fn(() => Promise.resolve([])),
		getEmptyLists: vi.fn(() => Promise.resolve([])),
		getWordByHash: vi.fn(() => Promise.resolve(undefined)),
		addToList,
		removeFromList: vi.fn(() => Promise.resolve()),
		updateProperty: vi.fn(() => Promise.resolve()),
	});
	await bookmarksStore.refresh();

	const { findByText } = renderReaderDocument('reader-1');
	await fireEvent.click(await findByText('你好'));
	await findByText('hello');

	const listTrigger = await screen.findByRole('button', { name: 'Choose bookmark lists' });
	expect(listTrigger).toBeTruthy();

	await user.click(listTrigger);
	await user.click(await screen.findByText('Test'));

	await waitFor(() => expect(addToList).toHaveBeenCalledWith('Test', { lexical_id: 'nihao' }));
});

it('toggles the reader settings popover from the header', async () => {
	const user = userEvent.setup();
	const { findByText, queryByText, getByRole } = renderReaderDocument('reader-1');

	await findByText('Story');
	expect(queryByText('Theme')).toBeNull();

	const settingsButton = getByRole('button', { name: 'Reader settings' });
	await user.click(settingsButton);

	expect(await findByText('Theme')).toBeTruthy();
	expect(await findByText('Text size')).toBeTruthy();
	expect(settingsButton.getAttribute('aria-expanded')).toBe('true');
	expect(settingsButton.getAttribute('aria-haspopup')).toBe('dialog');
	const settingsDialog = document.getElementById(settingsButton.getAttribute('aria-controls'));
	expect(settingsDialog?.getAttribute('role')).toBe('dialog');
	expect(settingsDialog?.getAttribute('aria-label')).toBe('Reader settings');
});

it('returns to the library when the back button is clicked', async () => {
	const user = userEvent.setup();
	const { findByText } = renderReaderDocument('reader-1');

	await user.click(await findByText('Library'));

	expect(window.location.hash).toBe('#/read');
});

it('navigates to the library when the route has no document id', async () => {
	window.location.hash = '#/start';
	renderReaderDocument(undefined);

	await waitFor(() => expect(window.location.hash).toBe('#/read'));
});

it('remeasures the available page on system text changes without changing Reader body sizing', async () => {
	let typographyListener;
	const stopTypography = vi.fn();
	vi.spyOn(systemTypography, 'subscribeSystemTypography').mockImplementation((listener) => {
		typographyListener = listener;
		return stopTypography;
	});
	const { container, findByText, unmount } = renderReaderDocument('reader-1');
	await findByText('你好');
	const pageElement = container.querySelector('.reader__page');
	Object.defineProperties(pageElement, {
		clientHeight: { configurable: true, value: 600 },
		clientWidth: { configurable: true, value: 400 },
	});
	readerRoute.setPageLayout.mockClear();
	typographyListener({ rootFontSizePx: 24, revision: 1 });
	await waitFor(() =>
		expect(readerRoute.setPageLayout).toHaveBeenCalledWith(
			expect.objectContaining({ contentWidth: 400, contentHeight: 600, fontSize: 20 })
		)
	);
	expect(
		container.querySelector('.reader').style.getPropertyValue('--reader-page-font-size')
	).toBe('20px');
	await unmount();
	expect(stopTypography).toHaveBeenCalledOnce();
});

it('keeps the current reading position when larger application controls leave less page space', async () => {
	let typographyListener;
	vi.spyOn(systemTypography, 'subscribeSystemTypography').mockImplementation((listener) => {
		typographyListener = listener;
		return () => {};
	});
	readerRoute.setPageLayout.mockRestore();
	const text = '你好世界'.repeat(500);
	const longDocument = {
		...READER_DOCUMENT,
		text,
		blocks: [
			{ id: 'block-1', kind: 'paragraph', text, start_offset: 0, end_offset: text.length },
		],
	};
	setReaderDocumentManagerForTest(
		buildReaderDocumentManager({
			getDocuments: vi.fn(() => Promise.resolve([longDocument])),
			getDocument: vi.fn(() => Promise.resolve(longDocument)),
			updateProgress: vi.fn(() => Promise.resolve(longDocument)),
		})
	);
	const { container, findByText } = renderReaderDocument('reader-1');
	await findByText('Story');
	const pageElement = container.querySelector('.reader__page');
	Object.defineProperties(pageElement, {
		clientHeight: { configurable: true, value: 400 },
		clientWidth: { configurable: true, value: 200 },
	});
	typographyListener({ rootFontSizePx: 16, revision: 1 });
	await waitFor(() => expect(readerRoute.pageCount).toBeGreaterThan(4));
	await readerRoute.goToPage(3);
	const readingAnchor = readerRoute.currentPage.start;
	const originalPageCount = readerRoute.pageCount;
	Object.defineProperty(pageElement, 'clientHeight', { configurable: true, value: 200 });
	typographyListener({ rootFontSizePx: 24, revision: 2 });
	await waitFor(() => expect(readerRoute.pageCount).toBeGreaterThan(originalPageCount));
	expect(readerRoute.currentPage.start).toBeLessThanOrEqual(readingAnchor);
	expect(readerRoute.currentPage.end).toBeGreaterThan(readingAnchor);
	expect(
		container.querySelector('.reader').style.getPropertyValue('--reader-page-font-size')
	).toBe('20px');
});
