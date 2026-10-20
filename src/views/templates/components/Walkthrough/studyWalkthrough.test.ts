import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import Router from 'svelte-spa-router';
import { invoke } from '@tauri-apps/api/core';
import Quiz from '@/routes/Study/Quiz.svelte';
import Study from '@/routes/Study.svelte';
import MobileStudy from '@/routes/mobile/MobileStudy.svelte';
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
		getListSummaries: async () =>
			Object.entries(lists).map(([name, words]) => ({ name, wordCount: words.length })),
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
	await walkthroughStore.load();
	Object.assign(walkthroughStore.preferences, createWalkthroughPreferences(), {
		featureInvitations: {},
	});
	studySubRouteStore.set(null);
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
			if (choice === 'example') {
				lists = { Empty: [], Short: [] };
				await bookmarksStore.refresh();
			}
			window.location.hash = studyHref('flashcards', initialList, 'bookmarks');
			window.dispatchEvent(new HashChangeEvent('hashchange'));
			render(Router, { routes: { '/study/flashcards': component } });
			await screen.findByText('No flashcards in this list');
			const helpButton = screen.getByRole('button', { name: 'Learn how flashcards work' });
			const exitButton = screen.getByRole('button', { name: 'Exit' });
			await fireEvent.click(helpButton);
			await waitFor(() => expect(walkthroughStore.phase).toBe('choosing'));
			const host = render(WalkthroughHost);
			if (choice === 'saved') {
				expect(screen.queryByRole('button', { name: 'Add sample words' })).toBeNull();
			}
			await fireEvent.click(
				screen.getByRole('button', {
					name: choice === 'saved' ? 'Ready vocabulary (4 words)' : 'Add sample words',
				})
			);

			expect((await screen.findByTestId('flashcard-front-simplified')).textContent).toBe(
				firstWord
			);
			expect(screen.queryByText('No flashcards in this list')).toBeNull();
			expect(screen.queryByRole('button', { name: 'Learn how flashcards work' })).toBeNull();
			expect(screen.getByRole('button', { name: 'Exit' })).toBe(exitButton);
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

			// A guide launched from Settings must retain card navigation and the flipped side.
			await walkthroughStore.start('flashcards', { listName });
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
			if (choice === 'example') {
				delete lists['Ready vocabulary'];
				await bookmarksStore.refresh();
			}
			render(Router, { routes: { '/study/quiz': component } });
			await screen.findByText(EMPTY_QUIZ_MESSAGE);
			const helpButton = screen.getByRole('button', { name: 'Learn how quizzes work' });
			const exitButton = screen.getByRole('button', { name: 'Exit' });
			await fireEvent.click(helpButton);
			await waitFor(() => expect(walkthroughStore.phase).toBe('choosing'));
			const host = render(WalkthroughHost);
			if (choice === 'saved') {
				expect(screen.queryByRole('button', { name: 'Add sample words' })).toBeNull();
			}
			await fireEvent.click(
				screen.getByRole('button', {
					name: choice === 'saved' ? 'Ready vocabulary (4 words)' : 'Add sample words',
				})
			);

			await screen.findByRole('button', { name: 'watermelon' });
			expect(screen.queryByText(EMPTY_QUIZ_MESSAGE)).toBeNull();
			expect(screen.queryByRole('button', { name: 'Learn how quizzes work' })).toBeNull();
			expect(screen.getByRole('button', { name: 'Exit' })).toBe(exitButton);
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

			// A guide launched from Settings must retain the answer already submitted.
			await walkthroughStore.start('quiz', { listName });
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

describe.each([
	{ layout: 'desktop', component: Study },
	{ layout: 'mobile', component: MobileStudy },
])('$layout Study sample refresh', ({ component }) => {
	it('offers the Study guide with existing lists until it has been completed', async () => {
		window.location.hash = '#/study';
		render(component);
		await screen.findByRole('button', { name: 'Flashcards for Ready vocabulary' });
		await fireEvent.click(screen.getByRole('button', { name: 'Learn how Study works' }));
		await waitFor(() => expect(walkthroughStore.phase).toBe('guiding'));
		walkthroughStore.skip();
		await tick();
		expect(screen.getByRole('button', { name: 'Learn how Study works' })).toBeTruthy();
		await walkthroughStore.start('study');
		while (walkthroughStore.visible) {
			walkthroughStore.next();
		}
		await tick();
		expect(screen.queryByRole('button', { name: 'Learn how Study works' })).toBeNull();
		expect(
			screen.getByRole('button', { name: 'Flashcards for Ready vocabulary' })
		).toBeTruthy();
	});

	it('shows a sample list and enables both practice modes without leaving Study', async () => {
		lists = { Bookmarks: [] };
		await bookmarksStore.refresh();
		window.location.hash = '#/study';
		render(component);
		await screen.findByText('Add words to a list to start studying.');
		await fireEvent.click(screen.getByRole('button', { name: 'Learn how Study works' }));
		await waitFor(() => expect(walkthroughStore.phase).toBe('guiding'));
		render(WalkthroughHost);
		await fireEvent.click(await screen.findByRole('button', { name: 'Add sample words' }));
		await waitFor(() => expect(walkthroughStore.exampleBusy).toBe(false));
		const listName = walkthroughStore.preferences.examples.listName;
		expect(lists[listName]).toHaveLength(6);
		await waitFor(() => {
			expect(
				(
					screen.getByRole('button', {
						name: `Flashcards for ${listName}`,
					}) as HTMLButtonElement
				).disabled
			).toBe(false);
			expect(
				(
					screen.getByRole('button', {
						name: `Start quiz for ${listName}`,
					}) as HTMLButtonElement
				).disabled
			).toBe(false);
		});
		expect(screen.queryByText('Add words to a list to start studying.')).toBeNull();
		expect(window.location.hash).toBe('#/study');
	});
});

describe.each([
	{ layout: 'desktop', guide: 'flashcards' as const, component: Flashcards },
	{ layout: 'mobile', guide: 'flashcards' as const, component: MobileStudyFlashcards },
	{ layout: 'desktop', guide: 'quiz' as const, component: Quiz },
	{ layout: 'mobile', guide: 'quiz' as const, component: MobileStudyQuiz },
])('$layout first-use $guide invitation', ({ guide, component }) => {
	it.each(['accept', 'decline'])(
		'offers a tour for ready content and remembers %s',
		async (choice) => {
			const instructionPause = vi.spyOn(quizRoute, 'setInstructionPaused');
			window.location.hash = studyHref(guide, 'Ready vocabulary');
			window.dispatchEvent(new HashChangeEvent('hashchange'));
			const view = render(Router, { routes: { [`/study/${guide}`]: component } });
			await waitFor(() => expect(walkthroughStore.phase).toBe('feature-invitation'));
			const host = render(WalkthroughHost);
			expect(
				screen.getByRole('heading', {
					name: `Try a quick ${guide === 'quiz' ? 'quiz' : 'flashcards'} tour?`,
				})
			).toBeTruthy();
			expect(walkthroughStore.quizSuspended).toBe(guide === 'quiz');
			if (guide === 'quiz') {
				expect(instructionPause).toHaveBeenLastCalledWith(true);
			}
			await fireEvent.click(
				screen.getByRole('button', { name: choice === 'accept' ? 'Start tour' : 'Not now' })
			);
			if (choice === 'accept') {
				await waitFor(() => expect(walkthroughStore.phase).toBe('guiding'));
				expect(walkthroughStore.preparation.context.listName).toBe('Ready vocabulary');
				walkthroughStore.skip();
			}
			expect(walkthroughStore.visible).toBe(false);
			expect(walkthroughStore.quizSuspended).toBe(false);
			await tick();
			if (guide === 'quiz') {
				expect(instructionPause).toHaveBeenLastCalledWith(false);
			}
			instructionPause.mockRestore();
			host.unmount();
			view.unmount();
			render(Router, { routes: { [`/study/${guide}`]: component } });
			await tick();
			await waitFor(() =>
				expect(guide === 'quiz' ? quizRoute.loading : flashcardsRoute.loading).toBe(false)
			);
			expect(walkthroughStore.visible).toBe(false);
		}
	);
});
