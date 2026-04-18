import { beforeEach, expect, vi } from 'vitest';
import { render, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import MobileBookmarks from './MobileBookmarks.svelte';
import { bookmarksStore } from '../../stores/bookmarks.svelte.js';
import {
	bookmarksActiveListStore,
	bookmarksActiveWordStore,
} from '../../stores/bookmarksRoute.svelte.js';
import { mobileBookmarksSnapStore } from '../../stores/mobileBookmarks.svelte.js';

const FIRST_TONE = 1;
const SECOND_TONE = 2;
const THIRD_TONE = 3;

vi.mock('lucide-svelte', async () => {
	const mockIcon = (await import('../../components/__mocks__/FeatherIcon.svelte')).default;
	return {
		Brush: mockIcon,
		Check: mockIcon,
		ChevronDown: mockIcon,
		ChevronUp: mockIcon,
		EllipsisVertical: mockIcon,
		FolderDown: mockIcon,
		FolderUp: mockIcon,
		Plus: mockIcon,
		Trash2: mockIcon,
		X: mockIcon,
	};
});

vi.mock('@tauri-apps/api/core', () => ({
	invoke: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../utils/index.js', async () => {
	const actual = await vi.importActual('../../utils/index.js');
	return {
		...actual,
		telemetry: {
			trackEvent: vi.fn(() => Promise.resolve()),
		},
		handleError: vi.fn(),
	};
});

const WORDS = [
	{
		_id: 'word-1',
		_rev: '1',
		word_id: 1,
		hash: 'xigua',
		traditional: '西瓜',
		simplified: '西瓜',
		english: ['watermelon'],
		pinyin_marks: 'xī guā',
		tone_marks: [FIRST_TONE, FIRST_TONE],
		measure_words: [],
		lists: ['Bookmarks'],
		notes: '',
	},
	{
		_id: 'word-2',
		_rev: '1',
		word_id: 2,
		hash: 'pingguo',
		traditional: '蘋果',
		simplified: '苹果',
		english: ['apple'],
		pinyin_marks: 'píng guǒ',
		tone_marks: [SECOND_TONE, THIRD_TONE],
		measure_words: [],
		lists: ['Bookmarks'],
		notes: '',
	},
];

function mockBookmarkManager() {
	return {
		waitForInit: () => Promise.resolve(),
		getLists: () => Promise.resolve(['Bookmarks']),
		getEmptyLists: () => Promise.resolve([]),
		getListContent: (listName) =>
			Promise.resolve(WORDS.filter((word) => word.lists.includes(listName))),
		inList: (hash) => Promise.resolve(WORDS.find((word) => word.hash === hash)?.lists ?? []),
		addToList: () => Promise.resolve(),
		removeFromList: () => Promise.resolve(),
	};
}

beforeEach(async () => {
	window.bookmarkManager = mockBookmarkManager();
	window.__TAURI__ = { dialog: { ask: vi.fn(() => Promise.resolve(false)) } };
	bookmarksActiveListStore.set('Bookmarks');
	bookmarksActiveWordStore.set(undefined);
	mobileBookmarksSnapStore.set('partial');
	await bookmarksStore.refresh();
});

it('renders bookmark list content and opens word details', async () => {
	const user = userEvent.setup();
	const { findByText } = render(MobileBookmarks);

	await user.click(await findByText('西瓜'));

	expect(await findByText('Definitions')).toBeTruthy();
});

it('collapses the snap sheet after clicking a bookmark', async () => {
	const user = userEvent.setup();
	mobileBookmarksSnapStore.set('full');
	const { findByText } = render(MobileBookmarks);

	await user.click(await findByText('西瓜'));

	expect(mobileBookmarksSnapStore.value).toBe('collapsed');
});

it('opens the snap sheet to partial when the bookmark filter is focused', async () => {
	const user = userEvent.setup();
	mobileBookmarksSnapStore.set('collapsed');
	const { findByPlaceholderText } = render(MobileBookmarks);

	await user.click(await findByPlaceholderText('Filter'));

	expect(mobileBookmarksSnapStore.value).toBe('partial');
});

it('opens the mobile overflow actions', async () => {
	const user = userEvent.setup();
	const { container, findByText } = render(MobileBookmarks);

	await waitFor(() => expect(container.querySelector('.mobile-bookmarks__results')).toBeTruthy());
	const overflowButton = container.querySelector('.mobile-bookmarks__overflow-anchor button');
	await user.click(overflowButton);

	expect(await findByText('Import')).toBeTruthy();
	expect(await findByText('Export')).toBeTruthy();
});

it('restores filtered bookmark rows when the filter is cleared', async () => {
	const user = userEvent.setup();
	const { findByPlaceholderText, findByText, queryByText } = render(MobileBookmarks);

	await findByText('西瓜');
	await findByText(/苹果/);

	const filterInput = await findByPlaceholderText('Filter');
	await user.type(filterInput, 'water');

	expect(await findByText('西瓜')).toBeTruthy();
	expect(queryByText(/苹果/)).toBeFalsy();

	await user.clear(filterInput);

	expect(await findByText('西瓜')).toBeTruthy();
	expect(await findByText(/苹果/)).toBeTruthy();
});
