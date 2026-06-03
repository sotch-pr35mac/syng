import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { invoke } from '@tauri-apps/api/core';
import { mockBookmarkManager, mockPreferenceManager } from '@test/utils/unitTestUtils.js';
import MobileReaderDocument from '@/routes/mobile/Reader/MobileReaderDocument.svelte';
import { readerRoute } from '@/composables/reader.svelte.js';
import { readerDocumentRouteStore } from '@/stores/readerRoute.svelte.js';
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

// Mobile reader runs on the touch shell, where swipe-to-turn is enabled.
vi.mock('@tauri-apps/plugin-os', () => ({
	platform: () => 'ios',
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

function renderMobileReaderDocument(documentId) {
	return render(MobileReaderDocument, {
		props: {
			params: documentId ? { id: documentId } : {},
		},
	});
}

beforeEach(() => {
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
	window.location.hash = '#/read/document/reader-1';
});

it('renders the routed document title and tokenized page text', async () => {
	const { findByText } = renderMobileReaderDocument('reader-1');

	expect(await findByText('Story')).toBeTruthy();
	expect(await findByText('你好')).toBeTruthy();
	expect(await findByText('世界')).toBeTruthy();
});

it('opens the dictionary when a token is clicked', async () => {
	const { findByText } = renderMobileReaderDocument('reader-1');

	// fireEvent (not userEvent) because the token is an inline element with no
	// layout box in jsdom, which userEvent's pointer sequence skips.
	await fireEvent.click(await findByText('你好'));

	await waitFor(() => expect(invoke).toHaveBeenCalledWith('query_by_chinese', { text: '你好' }));
});

it('toggles the reader settings popover from the header', async () => {
	const user = userEvent.setup();
	const { findByText, queryByText, getByRole } = renderMobileReaderDocument('reader-1');

	await findByText('Story');
	expect(queryByText('Theme')).toBeNull();

	await user.click(getByRole('button', { name: 'Reader settings' }));

	expect(await findByText('Theme')).toBeTruthy();
	expect(await findByText('Text size')).toBeTruthy();
});

it('restores the last reader route when opened without a document id', async () => {
	window.location.hash = '#/start';
	readerDocumentRouteStore.set('mobile-doc');

	renderMobileReaderDocument(undefined);

	await waitFor(() => expect(window.location.hash).toBe('#/read/document/mobile-doc'));
});
