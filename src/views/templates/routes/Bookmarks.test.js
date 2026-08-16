import { beforeEach, expect, vi } from 'vitest';
import { render, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { invoke } from '@tauri-apps/api/core';
import Bookmarks from '@/routes/Bookmarks.svelte';
import { bookmarksRoute } from '@/composables/bookmarks.svelte.js';
import { bookmarksStore } from '@/stores/bookmarks.svelte.js';
import {
	bookmarksActiveListStore,
	bookmarksActiveWordStore,
} from '@/stores/bookmarksRoute.svelte.js';
import { setBookmarkManagerForTest } from '@/utils/appServices.js';

vi.mock('lucide-svelte', async () => {
	const mockIcon = (await import('@/components/__mocks__/FeatherIcon.svelte')).default;
	return {
		Brush: mockIcon,
		Check: mockIcon,
		ChevronDown: mockIcon,
		ChevronLeft: mockIcon,
		ChevronRight: mockIcon,
		ChevronUp: mockIcon,
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

vi.mock('@tauri-apps/plugin-dialog', () => ({
	ask: vi.fn(() => Promise.resolve(false)),
}));

vi.mock('@tauri-apps/plugin-os', () => ({
	platform: () => 'macos',
}));

const WORDS = [
	{
		_id: 'word-1',
		_rev: '1',
		hash: 'xigua',
		traditional: '西瓜',
		simplified: '西瓜',
		english: ['watermelon'],
		pinyin_marks: 'xī guā',
		tone_marks: [1, 1],
		measure_words: [],
		lists: ['Bookmarks'],
		notes: '',
	},
	{
		_id: 'word-2',
		_rev: '1',
		hash: 'pingguo',
		traditional: '蘋果',
		simplified: '苹果',
		english: ['apple'],
		pinyin_marks: 'píng guǒ',
		tone_marks: [2, 3],
		measure_words: [],
		lists: ['Bookmarks'],
		notes: '',
	},
];

const IMPORTED_WORD = {
	hash: 'huoche',
	traditional: '火車',
	simplified: '火车',
	english: ['train'],
	pinyin_marks: 'huǒ chē',
	tone_marks: [3, 1],
	measure_words: [],
	notes: '',
};

let words;
let lists;

beforeEach(async () => {
	invoke.mockResolvedValue(null);
	words = WORDS.map((word) => ({ ...word, lists: [...word.lists] }));
	lists = ['Bookmarks'];
	setBookmarkManagerForTest({
		waitForInit: () => Promise.resolve(),
		getLists: () => Promise.resolve(lists),
		getListContent: (listName) =>
			Promise.resolve(words.filter((word) => word.lists.includes(listName))),
		inList: (hash) => Promise.resolve(words.find((word) => word.hash === hash)?.lists ?? []),
		createList: (listName) => {
			lists = [...lists, listName];
			return Promise.resolve();
		},
		addToList: (listName, wordToAdd) => {
			const existingWord = words.find((word) => word.hash === wordToAdd.hash);
			if (existingWord) {
				existingWord.lists = [...new Set([...existingWord.lists, listName])];
			} else {
				words = [
					...words,
					{
						...wordToAdd,
						_id: `imported-${wordToAdd.hash}`,
						_rev: '1',
						lists: [listName],
						notes: wordToAdd.notes ?? '',
					},
				];
			}
			return Promise.resolve();
		},
		removeFromList: (listName, wordToRemove) => {
			const word = words.find((item) => item.hash === wordToRemove.hash);
			if (word) {
				word.lists = word.lists.filter((item) => item !== listName);
			}
			return Promise.resolve();
		},
	});
	bookmarksActiveListStore.set('Bookmarks');
	bookmarksActiveWordStore.set(undefined);
	await bookmarksStore.refresh();
	await bookmarksRoute.setActiveList('Bookmarks');
});

it('removes the active row and advances the desktop details pane', async () => {
	const user = userEvent.setup();
	const { container, findByText } = render(Bookmarks);

	await user.click(await findByText('西瓜'));
	const removeAction = await findByText('Remove from Bookmarks');
	await user.click(removeAction.closest('button'));

	await waitFor(() => {
		expect(container.querySelector('.bookmarks--word-listing').textContent).not.toContain(
			'西瓜'
		);
	});
	expect(container.querySelector('.dictionary-content').textContent).toContain('苹果');
	expect(
		container.querySelector('.sy-list-preview-item-container--active').textContent
	).toContain('苹果');
});

it('preserves the current desktop state when list import is cancelled', async () => {
	const user = userEvent.setup();
	const { findByPlaceholderText, findByText } = render(Bookmarks);

	await user.click(await findByText('西瓜'));
	const filterInput = await findByPlaceholderText('Filter');
	await user.type(filterInput, 'water');
	await user.click((await findByText('Import')).closest('button'));

	await waitFor(() => expect(invoke).toHaveBeenCalled());
	expect(bookmarksActiveListStore.value).toBe('Bookmarks');
	expect(bookmarksActiveWordStore.value?.hash).toBe('xigua');
	expect(filterInput.value).toBe('water');
});

it('navigates desktop bookmarks to the resolved imported list', async () => {
	invoke.mockResolvedValueOnce({
		meta: { name: 'Bookmarks' },
		entries: [IMPORTED_WORD],
	});
	const user = userEvent.setup();
	const { container, findByPlaceholderText, findByText } = render(Bookmarks);

	await user.click(await findByText('西瓜'));
	const filterInput = await findByPlaceholderText('Filter');
	await user.type(filterInput, 'water');
	await user.click((await findByText('Import')).closest('button'));

	await waitFor(() => expect(bookmarksActiveListStore.value).toBe('Bookmarks 2'));
	expect(filterInput.value).toBe('');
	expect(bookmarksActiveWordStore.value).toBeUndefined();
	expect(container.querySelector('.bookmarks--header').textContent).toContain('Bookmarks 2');
	expect(container.querySelector('.bookmarks--word-listing').textContent).toContain('火车');
	expect(container.querySelector('.dictionary-content').textContent).not.toContain('Definitions');
});
