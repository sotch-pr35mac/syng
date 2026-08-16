import { beforeEach, expect, vi } from 'vitest';
import { render, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import Bookmarks from '@/routes/Bookmarks.svelte';
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

let words;

beforeEach(async () => {
	words = WORDS.map((word) => ({ ...word, lists: [...word.lists] }));
	setBookmarkManagerForTest({
		waitForInit: () => Promise.resolve(),
		getLists: () => Promise.resolve(['Bookmarks']),
		getListContent: (listName) =>
			Promise.resolve(words.filter((word) => word.lists.includes(listName))),
		inList: (hash) => Promise.resolve(words.find((word) => word.hash === hash)?.lists ?? []),
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
