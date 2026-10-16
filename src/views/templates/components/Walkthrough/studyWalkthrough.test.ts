import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import Router from 'svelte-spa-router';
import { invoke } from '@tauri-apps/api/core';
import Quiz from '@/routes/Study/Quiz.svelte';
import MobileStudyQuiz from '@/routes/mobile/Study/MobileStudyQuiz.svelte';
import Flashcards from '@/routes/Study/Flashcards.svelte';
import MobileStudyFlashcards from '@/routes/mobile/Study/MobileStudyFlashcards.svelte';
import WalkthroughHost from '@/components/Walkthrough/WalkthroughHost.svelte';
import { quizRoute } from '@/composables/quiz.svelte.js';
import { flashcardsRoute } from '@/composables/flashcards.svelte.js';
import { EMPTY_QUIZ_MESSAGE, studyHref } from '@/composables/study.js';
import { studyOriginStore, studySubRouteStore } from '@/stores/studyRoute.svelte.js';
import {
	flashcardsActiveIndexStore,
	flashcardsActiveListStore,
	flashcardsShowDetailsStore,
} from '@/stores/flashcards.svelte.js';
import { walkthroughStore } from '@/stores/walkthrough.svelte.js';
import { bookmarksStore, type BookmarkWordEntry } from '@/stores/bookmarks.svelte.js';
import { setBookmarkManagerForTest, setPreferenceManagerForTest } from '@/utils/appServices.js';
import { telemetry } from '@/utils/telemetry.js';
import { createWalkthroughPreferences } from '@/types/walkthrough.js';
import type { LexicalUnit } from '@/types/dictionary.js';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/plugin-os', () => ({ platform: () => 'macos' }));
vi.mock('@/utils/telemetry.js', () => ({
	telemetry: { trackEvent: vi.fn(async () => {}), trackScreen: vi.fn(async () => {}) },
}));

function word(text: string): LexicalUnit {
	return {
		id: `1:${text}`,
		simplified: text,
		traditional: text,
		pinyin: { marks: '', numbers: '', tones: [] },
		commonness: 0,
		alternative_pronunciations: [],
		measure_words: [],
		hsk: { hsk_2015: [], proficiency_standard_2021: [], hsk_exam_syllabus_2025: [] },
		english: [],
	};
}

function bookmark(text: string): BookmarkWordEntry {
	const entry = word(text);
	return { ...entry, lexical_id: entry.id, _id: entry.id, _rev: '1', lists: [], notes: '' };
}

const question = {
	kind: 'Characters',
	question: '西瓜',
	options: ['watermelon', 'apple', 'pear', 'plum'].map((value) => ({ value })),
	answer: 'watermelon',
	time_limit: 60,
	lexical_unit: word('西瓜'),
};
let lists: Record<string, BookmarkWordEntry[]>;

beforeEach(async () => {
	vi.clearAllMocks();
	Element.prototype.animate = vi.fn(() => ({
		cancel: vi.fn(),
		finished: Promise.resolve(),
		onfinish: null,
	})) as never;
	lists = {
		Empty: [],
		Short: [bookmark('书')],
		'Ready vocabulary': ['西瓜', '苹果', '梨', '李子'].map(bookmark),
	};
	setBookmarkManagerForTest({
		waitForInit: async () => {},
		getLists: async () => Object.keys(lists),
		getListContent: async (name: string) => lists[name] ?? [],
		createList: async (name: string) => {
			lists[name] = [];
		},
		addToList: async (name: string, entry: { lexical_id: string }) => {
			lists[name].push(bookmark(entry.lexical_id.slice(2)));
		},
		inList: async () => [],
	} as never);
	const preferences: Record<string, unknown> = { walkthrough: createWalkthroughPreferences() };
	setPreferenceManagerForTest({
		waitForInit: async () => {},
		get: (name: string) => preferences[name],
		set: (name: string, value: unknown) => {
			preferences[name] = value;
		},
	} as never);
	vi.mocked(invoke).mockImplementation(async (command, args) => {
		switch (command) {
			case 'query_by_chinese':
				return [word((args as { text: string }).text)];
			case 'get_next_question':
				return { completed: 0, pending: 4, question: { MultipleChoice: question } };
			case 'answer_question':
				return { correct: true, question: { MultipleChoice: question } };
			default:
				return null;
		}
	});
	quizRoute.reset();
	flashcardsActiveListStore.set(null);
	flashcardsActiveIndexStore.set(0);
	flashcardsShowDetailsStore.set(false);
	window.location.hash = studyHref('quiz', 'Short', 'bookmarks');
	window.dispatchEvent(new HashChangeEvent('hashchange'));
	await bookmarksStore.refresh();
});

afterEach(() => {
	cleanup();
	walkthroughStore.interrupt();
});

describe.each([
	{ layout: 'desktop', component: Flashcards },
	{ layout: 'mobile', component: MobileStudyFlashcards },
])('$layout flashcards walkthrough', ({ component }) => {
	it.each([
		{ initialList: 'Empty', choice: 'saved', listName: 'Ready vocabulary', firstWord: '西瓜' },
		{
			initialList: 'Empty',
			choice: 'example',
			listName: 'Syng Example Vocabulary',
			firstWord: '学习',
		},
		{
			initialList: 'Deleted',
			choice: 'saved',
			listName: 'Ready vocabulary',
			firstWord: '西瓜',
		},
		{
			initialList: 'Deleted',
			choice: 'example',
			listName: 'Syng Example Vocabulary',
			firstWord: '学习',
		},
	])(
		'loads the $choice list chosen from help for an $initialList list without remounting',
		async ({ initialList, choice, listName, firstWord }) => {
			window.location.hash = studyHref('flashcards', initialList, 'bookmarks');
			window.dispatchEvent(new HashChangeEvent('hashchange'));
			render(Router, { routes: { '/study/flashcards': component } });
			await screen.findByText('No flashcards in this list');
			const helpButton = screen.getByRole('button', { name: 'Show me how' });
			await fireEvent.click(helpButton);
			await waitFor(() => expect(walkthroughStore.phase).toBe('choosing'));
			const host = render(WalkthroughHost);
			await fireEvent.click(
				screen.getByRole('button', {
					name:
						choice === 'saved'
							? 'Ready vocabulary (4 words)'
							: /(?:Add|Use) example vocabulary/,
				})
			);

			expect((await screen.findByTestId('flashcard-front-simplified')).textContent).toBe(
				firstWord
			);
			expect(screen.queryByText('No flashcards in this list')).toBeNull();
			expect(screen.getByRole('button', { name: 'Show me how' })).toBe(helpButton);
			expect(flashcardsRoute.activeList).toBe(listName);
			expect(window.location.hash).toBe(studyHref('flashcards', listName, 'bookmarks'));
			expect(flashcardsRoute.activeIndex).toBe(0);
			expect(flashcardsRoute.showDetails).toBe(false);

			walkthroughStore.skip();
			await tick();
			host.unmount();
			await fireEvent.click(screen.getByRole('button', { name: 'Next' }));
			expect(flashcardsRoute.activeIndex).toBe(1);
			expect(screen.getByTestId('flashcard-front-simplified').textContent).toBe(
				lists[listName][1].simplified
			);
			await fireEvent.click(screen.getByRole('button', { name: 'Flip' }));
			expect(flashcardsRoute.showDetails).toBe(true);

			// Help must follow the new list without resetting card navigation or the flipped side.
			await fireEvent.click(helpButton);
			await waitFor(() => expect(walkthroughStore.phase).toBe('guiding'));
			expect(walkthroughStore.preparation.context.listName).toBe(listName);
			walkthroughStore.next();
			await tick();
			walkthroughStore.back();
			await tick();
			walkthroughStore.skip();
			await tick();
			expect(flashcardsRoute.activeIndex).toBe(1);
			expect(flashcardsRoute.showDetails).toBe(true);
			expect(
				vi
					.mocked(telemetry.trackEvent)
					.mock.calls.filter(([event]) => event === 'flashcards.started')
			).toHaveLength(1);
			await fireEvent.click(screen.getByRole('button', { name: 'Exit' }));
			expect(window.location.hash).toBe(`#/bookmarks?list=${encodeURIComponent(listName)}`);
			await tick();
			expect(studyOriginStore.value).toBeNull();
			expect(studySubRouteStore.value).toBeNull();
		}
	);
});

describe.each([
	{ layout: 'desktop', component: Quiz },
	{ layout: 'mobile', component: MobileStudyQuiz },
])('$layout quiz walkthrough', ({ component }) => {
	it.each([
		{ choice: 'saved', listName: 'Ready vocabulary', count: 4 },
		{ choice: 'example', listName: 'Syng Example Vocabulary', count: 6 },
	])(
		'loads the $choice list chosen from help without remounting the route',
		async ({ choice, listName, count }) => {
			render(Router, { routes: { '/study/quiz': component } });
			await screen.findByText(EMPTY_QUIZ_MESSAGE);
			const helpButton = screen.getByRole('button', { name: 'Show me how' });
			await fireEvent.click(helpButton);
			await waitFor(() => expect(walkthroughStore.phase).toBe('choosing'));
			const host = render(WalkthroughHost);
			await fireEvent.click(
				screen.getByRole('button', {
					name:
						choice === 'saved'
							? 'Ready vocabulary (4 words)'
							: /(?:Add|Use) example vocabulary/,
				})
			);

			await screen.findByRole('button', { name: 'watermelon' });
			expect(screen.queryByText(EMPTY_QUIZ_MESSAGE)).toBeNull();
			expect(screen.getByRole('button', { name: 'Show me how' })).toBe(helpButton);
			expect(quizRoute.activeList).toBe(listName);
			expect(window.location.hash).toBe(studyHref('quiz', listName, 'bookmarks'));
			expect(lists[listName]).toHaveLength(count);
			expect(invoke).toHaveBeenCalledWith('start_quiz', {
				config: expect.objectContaining({
					lexical_ids: lists[listName].map((entry) => entry.lexical_id),
				}),
			});
			expect(
				document.querySelector('[data-walkthrough-target="quiz-question"]')
			).not.toBeNull();
			expect(
				document.querySelector('[data-walkthrough-target="quiz-options"]')
			).not.toBeNull();

			// Guide navigation and closing help must preserve the newly loaded quiz.
			walkthroughStore.next();
			await tick();
			walkthroughStore.back();
			await tick();
			walkthroughStore.skip();
			await tick();
			host.unmount();
			await fireEvent.click(screen.getByRole('button', { name: 'watermelon' }));
			await waitFor(() => expect(quizRoute.showAnswer).toBe(true));
			expect(invoke).toHaveBeenCalledWith('answer_question', {
				response: expect.objectContaining({ response: 'watermelon' }),
			});

			// Reopening help must use the new list and retain the answer already submitted.
			await fireEvent.click(helpButton);
			await waitFor(() => expect(walkthroughStore.phase).toBe('guiding'));
			expect(walkthroughStore.preparation.context.listName).toBe(listName);
			expect(quizRoute.showAnswer).toBe(true);
			expect(
				vi.mocked(invoke).mock.calls.filter(([command]) => command === 'start_quiz')
			).toHaveLength(1);
			walkthroughStore.skip();
			await tick();
			await fireEvent.click(screen.getByRole('button', { name: 'Exit' }));
			expect(window.location.hash).toBe(`#/bookmarks?list=${encodeURIComponent(listName)}`);
			await tick();
			expect(studyOriginStore.value).toBeNull();
			expect(studySubRouteStore.value).toBeNull();
		}
	);
});
