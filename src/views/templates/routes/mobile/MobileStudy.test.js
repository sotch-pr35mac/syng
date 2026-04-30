import { beforeEach, expect, vi } from 'vitest';
import { render, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { invoke } from '@tauri-apps/api/core';
import MobileStudy from '@/routes/mobile/MobileStudy.svelte';
import MobileStudyFlashcards from '@/routes/mobile/MobileStudyFlashcards.svelte';
import MobileStudyQuiz from '@/routes/mobile/MobileStudyQuiz.svelte';
import { bookmarksStore } from '@/stores/bookmarks.svelte.js';
import {
	flashcardsActiveIndexStore,
	flashcardsActiveListStore,
	flashcardsShowDetailsStore,
} from '@/stores/flashcards.svelte.js';
import { studySubRouteStore } from '@/stores/studyRoute.svelte.js';
import { quizRoute } from '@/composables/quiz.svelte.js';
import { setBookmarkManagerForTest } from '@/utils/appServices.js';

vi.mock('lucide-svelte', async () => {
	const mockIcon = (await import('@/components/__mocks__/FeatherIcon.svelte')).default;
	return {
		ArrowLeft: mockIcon,
		ArrowRight: mockIcon,
		Award: mockIcon,
		Brush: mockIcon,
		Check: mockIcon,
		Pause: mockIcon,
		Plus: mockIcon,
		Play: mockIcon,
		RotateCcw: mockIcon,
		RotateCw: mockIcon,
		SquareStack: mockIcon,
		X: mockIcon,
	};
});

vi.mock('@tauri-apps/api/core', () => ({
	invoke: vi.fn((cmd) => {
		switch (cmd) {
			case 'start_quiz':
				return Promise.resolve(null);
			case 'get_next_question':
				return Promise.resolve({
					completed: 0,
					pending: 1,
					question: {
						MultipleChoice: {
							question: '西瓜',
							options: ['watermelon', 'apple', 'pear', 'plum'],
							answer: 'watermelon',
							time_limit: 10,
							word_data: WORDS[0],
						},
					},
				});
			case 'answer_question':
				return Promise.resolve({
					correct: true,
					question: {
						MultipleChoice: {
							word_data: WORDS[0],
						},
					},
				});
			case 'score_quiz':
				return Promise.resolve({ score: 100, correct: 1, total: 1 });
			case 'get_incorrect_questions':
				return Promise.resolve([]);
			default:
				return Promise.resolve(null);
		}
	}),
}));

vi.mock('@/utils/index.js', async () => {
	const actual = await vi.importActual('@/utils/index.js');
	return {
		...actual,
		telemetry: {
			trackEvent: vi.fn(() => Promise.resolve()),
			trackScreen: vi.fn(() => Promise.resolve()),
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
		tone_marks: [1, 1],
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
		// eslint-disable-next-line no-magic-numbers
		tone_marks: [2, 3],
		measure_words: [],
		lists: ['Bookmarks'],
		notes: '',
	},
	{
		_id: 'word-3',
		_rev: '1',
		word_id: 3,
		hash: 'li',
		traditional: '梨',
		simplified: '梨',
		english: ['pear'],
		pinyin_marks: 'lí',
		tone_marks: [2],
		measure_words: [],
		lists: ['Bookmarks'],
		notes: '',
	},
	{
		_id: 'word-4',
		_rev: '1',
		word_id: 4,
		hash: 'lizi',
		traditional: '李子',
		simplified: '李子',
		english: ['plum'],
		pinyin_marks: 'lǐ zi',
		// eslint-disable-next-line no-magic-numbers
		tone_marks: [3, 5],
		measure_words: [],
		lists: ['Bookmarks'],
		notes: '',
	},
];

function mockBookmarkManager() {
	return {
		waitForInit: () => Promise.resolve(),
		getLists: () => Promise.resolve(['Bookmarks', 'Empty List']),
		getEmptyLists: () => Promise.resolve(['Empty List']),
		getListContent: (listName) =>
			Promise.resolve(WORDS.filter((word) => word.lists.includes(listName))),
		inList: (hash) => Promise.resolve(WORDS.find((word) => word.hash === hash)?.lists ?? []),
		addToList: () => Promise.resolve(),
		removeFromList: () => Promise.resolve(),
	};
}

beforeEach(async () => {
	vi.clearAllMocks();
	Element.prototype.animate = vi.fn(() => ({
		cancel: vi.fn(),
		finished: Promise.resolve(),
		onfinish: null,
	}));
	setBookmarkManagerForTest(mockBookmarkManager());
	window.location.hash = '#/study';
	studySubRouteStore.set(null);
	flashcardsActiveListStore.set(null);
	flashcardsActiveIndexStore.set(0);
	flashcardsShowDetailsStore.set(false);
	quizRoute.reset();
	await bookmarksStore.refresh();
});

it('renders populated study lists and opens flashcards', async () => {
	const user = userEvent.setup();
	const { findByText, getAllByTestId, queryByText } = render(MobileStudy);

	expect(await findByText('Bookmarks')).toBeTruthy();
	await waitFor(() => expect(queryByText('Empty List')).toBeFalsy());

	await user.click(getAllByTestId('sy-button')[0]);
	expect(window.location.hash).toBe('#/study/flashcards?list=Bookmarks');
});

it('restores mobile flashcards and clears restore state on exit', async () => {
	const user = userEvent.setup();
	window.location.hash = '#/study/flashcards?list=Bookmarks';
	flashcardsActiveListStore.set('Bookmarks');
	flashcardsActiveIndexStore.set(1);
	flashcardsShowDetailsStore.set(true);

	const { container, findByText } = render(MobileStudyFlashcards);

	expect(await findByText('Definitions')).toBeTruthy();
	expect(flashcardsActiveIndexStore.value).toBe(1);
	expect(flashcardsShowDetailsStore.value).toBe(true);

	const exitButton = container.querySelector('.mobile-flashcards__exit-button');
	await user.click(exitButton);
	expect(window.location.hash).toBe('#/study');
	expect(studySubRouteStore.value).toBe(null);
	expect(flashcardsActiveIndexStore.value).toBe(0);
	expect(flashcardsShowDetailsStore.value).toBe(false);
});

it('answers a mobile quiz question and shows final results', async () => {
	const user = userEvent.setup();
	window.location.hash = '#/study/quiz?list=Bookmarks';
	const { findByText } = render(MobileStudyQuiz);

	await user.click(await findByText('watermelon'));
	expect(await findByText('Finish')).toBeTruthy();

	await user.click(await findByText('Finish'));
	expect(await findByText('100%')).toBeTruthy();
});

it('does not start the mobile quiz timer when the list cannot generate questions', async () => {
	window.location.hash = '#/study/quiz?list=Empty%20List';
	const { findByText, queryByRole } = render(MobileStudyQuiz);

	expect(await findByText('No Questions Available')).toBeTruthy();
	expect(queryByRole('button', { name: 'Pause timer' })).toBeFalsy();
	expect(invoke).not.toHaveBeenCalledWith('start_quiz', expect.anything());
});
