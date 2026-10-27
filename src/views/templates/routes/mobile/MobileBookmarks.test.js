import { beforeEach, expect, vi } from 'vitest';
import { render, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { invoke } from '@tauri-apps/api/core';
import MobileBookmarks from '@/routes/mobile/MobileBookmarks.svelte';
import { bookmarksRoute } from '@/composables/bookmarks.svelte.js';
import { bookmarksStore } from '@/stores/bookmarks.svelte.js';
import {
	bookmarksActiveListStore,
	bookmarksActiveWordStore,
} from '@/stores/bookmarksRoute.svelte.js';
import { mobileBookmarksSnapStore } from '@/stores/mobileBookmarks.svelte.js';
import { setBookmarkManagerForTest } from '@/utils/appServices.js';

const FIRST_TONE = 1;
const SECOND_TONE = 2;
const THIRD_TONE = 3;

vi.mock('lucide-svelte', async () => {
	const mockIcon = (await import('@/components/__mocks__/FeatherIcon.svelte')).default;
	return {
		Award: mockIcon,
		Brush: mockIcon,
		Blocks: mockIcon,
		ChevronLeft: mockIcon,
		ChevronRight: mockIcon,
		Check: mockIcon,
		ChevronDown: mockIcon,
		ChevronUp: mockIcon,
		EllipsisVertical: mockIcon,
		FolderDown: mockIcon,
		FolderUp: mockIcon,
		Plus: mockIcon,
		SquareStack: mockIcon,
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

vi.mock('@/utils/index.js', async () => {
	const actual = await vi.importActual('@/utils/index.js');
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
		lexical_id: '1:xigua',
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
		lexical_id: '1:pingguo',
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

const IMPORTED_WORD = {
	lexical_id: '1:huoche',
	traditional: '火車',
	simplified: '火车',
	english: ['train'],
	pinyin_marks: 'huǒ chē',
	tone_marks: [THIRD_TONE, FIRST_TONE],
	measure_words: [],
	notes: '',
};

let words;
let lists;

function mockBookmarkManager() {
	return {
		waitForInit: () => Promise.resolve(),
		getLists: () => Promise.resolve(lists),
		getEmptyLists: () => Promise.resolve([]),
		getListContent: (listName) =>
			Promise.resolve(words.filter((word) => word.lists.includes(listName))),
		inList: (lexicalId) =>
			Promise.resolve(words.find((word) => word.lexical_id === lexicalId)?.lists ?? []),
		createList: (listName) => {
			lists = [...lists, listName];
			return Promise.resolve();
		},
		addToList: (listName, wordToAdd) => {
			const word = words.find((item) => item.lexical_id === wordToAdd.lexical_id);
			if (word && !word.lists.includes(listName)) {
				word.lists = [...word.lists, listName];
			} else if (!word) {
				words = [
					...words,
					{
						...IMPORTED_WORD,
						...wordToAdd,
						_id: `imported-${wordToAdd.lexical_id}`,
						_rev: '1',
						lists: [listName],
						notes: wordToAdd.notes ?? '',
					},
				];
			}
			return Promise.resolve();
		},
		removeFromList: (listName, wordToRemove) => {
			const word = words.find((item) => item.lexical_id === wordToRemove.lexical_id);
			if (word) {
				word.lists = word.lists.filter((item) => item !== listName);
			}
			return Promise.resolve();
		},
	};
}

beforeEach(async () => {
	window.location.hash = '#/bookmarks';
	invoke.mockResolvedValue(null);
	words = WORDS.map((word) => ({ ...word, lists: [...word.lists] }));
	lists = ['Bookmarks'];
	setBookmarkManagerForTest(mockBookmarkManager());
	bookmarksActiveListStore.set('Bookmarks');
	bookmarksActiveWordStore.set(undefined);
	mobileBookmarksSnapStore.set('partial');
	await bookmarksStore.refresh();
	await bookmarksRoute.setActiveList('Bookmarks');
});

it.each([
	{ count: 0, flashcards: false, quiz: false },
	{ count: 1, flashcards: true, quiz: false },
	{ count: 3, flashcards: true, quiz: false },
	{ count: 4, flashcards: true, quiz: true },
])('enables mobile study buttons for $count words', async ({ count, flashcards, quiz }) => {
	words = Array.from({ length: count }, (_, index) => ({
		...WORDS[index % WORDS.length],
		_id: `study-word-${index}`,
		lexical_id: `study-word-${index}`,
	}));
	await bookmarksRoute.updateListContent();
	const view = render(MobileBookmarks);
	await waitFor(() => expect(bookmarksRoute.contentStatus).toBe('ready'));
	const flashcardsButton = view.getByRole('button', { name: 'Flashcards' });
	const quizButton = view.getByRole('button', { name: 'Quiz' });
	expect(flashcardsButton.disabled).toBe(!flashcards);
	expect(quizButton.disabled).toBe(!quiz);
	if (flashcards && !quiz) {
		expect(view.getByText('Quiz needs at least 4 words')).toBeTruthy();
	}
	if (!quiz) {
		await userEvent.click(quizButton);
		expect(window.location.hash).toBe('#/bookmarks');
	}
});

it.each([
	{ label: 'Flashcards', route: 'flashcards', snap: 'partial' },
	{ label: 'Quiz', route: 'quiz', snap: 'partial' },
	{ label: 'Flashcards', route: 'flashcards', snap: 'full' },
	{ label: 'Quiz', route: 'quiz', snap: 'full' },
])('starts $label from the $snap sheet using the full list', async ({ label, route, snap }) => {
	const listName = '词 & # 1';
	lists.push(listName);
	words = Array.from({ length: 4 }, (_, index) => ({
		...WORDS[index % WORDS.length],
		_id: `study-word-${index}`,
		lexical_id: `study-word-${index}`,
		lists: [listName],
	}));
	await bookmarksStore.refresh();
	await bookmarksRoute.setActiveList(listName);
	mobileBookmarksSnapStore.set(snap);
	const view = render(MobileBookmarks);
	await userEvent.type(view.getByPlaceholderText('Filter'), 'no-match');
	expect(await view.findByText('No words match your filter.')).toBeTruthy();
	await userEvent.click(view.getByRole('button', { name: label }));
	expect(window.location.hash).toBe(
		`#/study/${route}?list=${encodeURIComponent(listName)}&from=bookmarks`
	);
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
	const overflowButton = container.querySelector('button[aria-label="List actions"]');
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

it('selects the next bookmark after removing the active word', async () => {
	const user = userEvent.setup();
	const { container, findByText } = render(MobileBookmarks);

	await user.click(await findByText('西瓜'));
	const removeAction = await findByText('Remove from Bookmarks');
	await user.click(removeAction.closest('button'));

	await waitFor(() => {
		expect(container.querySelector('.mobile-bookmarks__results').textContent).not.toContain(
			'西瓜'
		);
	});
	expect(container.querySelector('.mobile-bookmarks__dict-wrapper').textContent).toContain(
		'苹果'
	);
	expect(
		container.querySelector('.sy-list-preview-item-container--active').textContent
	).toContain('苹果');
});

it('selects the previous bookmark after removing the last active word', async () => {
	const user = userEvent.setup();
	const { container, findByText } = render(MobileBookmarks);

	await user.click(await findByText(/苹果/));
	const removeAction = await findByText('Remove from Bookmarks');
	await user.click(removeAction.closest('button'));

	await waitFor(() => {
		expect(container.querySelector('.mobile-bookmarks__results').textContent).not.toContain(
			'苹果'
		);
	});
	expect(container.querySelector('.mobile-bookmarks__dict-wrapper').textContent).toContain(
		'西瓜'
	);
});

it('clears an exhausted filter and selects from the remaining bookmarks', async () => {
	const user = userEvent.setup();
	const { container, findByPlaceholderText, findByText } = render(MobileBookmarks);
	const filterInput = await findByPlaceholderText('Filter');
	await user.type(filterInput, 'watermelon');
	await user.click(await findByText('西瓜'));
	const removeAction = await findByText('Remove from Bookmarks');
	await user.click(removeAction.closest('button'));

	await waitFor(() => expect(filterInput.value).toBe(''));
	expect(container.querySelector('.mobile-bookmarks__results').textContent).toContain('苹果');
	expect(container.querySelector('.mobile-bookmarks__dict-wrapper').textContent).toContain(
		'苹果'
	);
});

it('shows the empty-list next step after removing the final bookmark', async () => {
	words = [words[0]];
	const user = userEvent.setup();
	const { findByText } = render(MobileBookmarks);

	await user.click(await findByText('西瓜'));
	const removeAction = await findByText('Remove from Bookmarks');
	await user.click(removeAction.closest('button'));

	expect(
		await findByText('This list is empty. Search for a word, then add it to this list.')
	).toBeTruthy();
});

it('navigates mobile bookmarks to a successfully imported list', async () => {
	invoke.mockResolvedValueOnce({
		meta: { name: 'Travel' },
		entries: [IMPORTED_WORD],
	});
	const user = userEvent.setup();
	const { container, findByPlaceholderText, findByText } = render(MobileBookmarks);

	await user.click(await findByText('西瓜'));
	const filterInput = await findByPlaceholderText('Filter');
	await user.type(filterInput, 'water');
	const overflowButton = container.querySelector('button[aria-label="List actions"]');
	await user.click(overflowButton);
	await user.click(await findByText('Import'));

	await waitFor(() => expect(bookmarksActiveListStore.value).toBe('Travel'));
	expect(filterInput.value).toBe('');
	expect(bookmarksActiveWordStore.value).toBeUndefined();
	expect(container.querySelector('.mobile-bookmarks__header-row').textContent).toContain(
		'Travel'
	);
	expect(container.querySelector('.mobile-bookmarks__results').textContent).toContain('火车');
	expect(await findByText('Select a word from your bookmarks')).toBeTruthy();
});

it('moves keyboard focus from a selected sheet row to its dictionary heading', async () => {
	const user = userEvent.setup();
	mobileBookmarksSnapStore.set('full');
	const { findByRole } = render(MobileBookmarks);
	const row = await findByRole('button', { name: /西瓜.*watermelon/ });
	row.focus();
	await user.keyboard('{Enter}');
	await waitFor(() => {
		expect(document.activeElement).toBe(
			document.querySelector('.mobile-bookmarks__dict-wrapper h1')
		);
	});
	expect(mobileBookmarksSnapStore.value).toBe('collapsed');
});
