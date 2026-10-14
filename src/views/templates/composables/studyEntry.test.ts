import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { bookmarksStore } from '@/stores/bookmarks.svelte.js';
import { NATIVE_COMMANDS } from '@/types/nativeCommands.js';
import { studyHref } from '@/composables/study.js';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('@/utils/index.js', () => ({
	handleError: vi.fn(),
	telemetry: { trackEvent: vi.fn(() => Promise.resolve()) },
}));
vi.mock('@/stores/bookmarks.svelte.js', () => ({
	bookmarksStore: {
		getContent: vi.fn(),
		getListSummaries: vi.fn(),
		lists: ['词 & # 1'],
		initialized: true,
	},
}));

let flashcards: typeof import('@/composables/flashcards.svelte.js').flashcardsRoute;
let quiz: typeof import('@/composables/quiz.svelte.js').quizRoute;
let studyState: typeof import('@/stores/studyRoute.svelte.js');
let flashcardsState: typeof import('@/stores/flashcards.svelte.js');
const words = Array.from({ length: 4 }, (_unused, index) => ({
	lexical_id: `1:word-${index}`,
	id: `1:word-${index}`,
}));
const question = {
	question: { MultipleChoice: { kind: 'English', time_limit: 10, lexical_unit: words[0] } },
	completed: 0,
	pending: 1,
};

beforeEach(async () => {
	vi.useFakeTimers();
	vi.resetModules();
	vi.mocked(bookmarksStore.getContent)
		.mockReset()
		.mockResolvedValue(words as never);
	vi.mocked(bookmarksStore.getListSummaries)
		.mockReset()
		.mockResolvedValue([{ name: '词 & # 1', wordCount: 4 }]);
	vi.mocked(invoke)
		.mockReset()
		.mockImplementation(async (command) => {
			return command === NATIVE_COMMANDS.QUIZ.NEXT_QUESTION ? question : null;
		});
	studyState = await import('@/stores/studyRoute.svelte.js');
	flashcardsState = await import('@/stores/flashcards.svelte.js');
	flashcards = (await import('@/composables/flashcards.svelte.js')).flashcardsRoute;
	quiz = (await import('@/composables/quiz.svelte.js')).quizRoute;
	window.location.hash = '#/study';
});

afterEach(() => {
	flashcards.endSession();
	quiz.endSession();
	vi.useRealTimers();
});

it.each([0, 1, 3, 4])(
	'rechecks quiz eligibility against the actual %i words',
	async (wordCount) => {
		vi.mocked(bookmarksStore.getContent).mockResolvedValueOnce(
			words.slice(0, wordCount) as never
		);
		quiz.start('词 & # 1', 'bookmarks');
		await vi.advanceTimersByTimeAsync(0);
		expect(quiz.loading).toBe(false);
		if (wordCount < 4) {
			expect(quiz.unavailableMessage).toBe('Quiz needs at least 4 words');
			expect(quiz.canStudyFlashcards).toBe(wordCount > 0);
			expect(invoke).not.toHaveBeenCalled();
		} else {
			expect(invoke).toHaveBeenCalledWith(NATIVE_COMMANDS.QUIZ.START, expect.anything());
		}
	}
);

it('preserves the originating list through retakes and switching to flashcards', async () => {
	quiz.start('词 & # 1', 'bookmarks');
	await vi.advanceTimersByTimeAsync(0);
	quiz.retake();
	await vi.advanceTimersByTimeAsync(0);
	quiz.studyFlashcards();
	expect(window.location.hash).toBe(studyHref('flashcards', '词 & # 1', 'bookmarks'));
	flashcards.load('词 & # 1', 'bookmarks');
	await vi.advanceTimersByTimeAsync(0);
	flashcards.exit();
	expect(window.location.hash).toBe('#/bookmarks?list=%E8%AF%8D%20%26%20%23%201');
	expect(studyState.studyOriginStore.value).toBe(null);
});

it('normal launches clear a previous bookmark origin and still exit to Study', async () => {
	studyState.studyOriginStore.set('bookmarks');
	flashcards.load('词 & # 1');
	await vi.advanceTimersByTimeAsync(0);
	flashcards.exit();
	expect(window.location.hash).toBe('#/study');
	quiz.start('词 & # 1');
	await vi.advanceTimersByTimeAsync(0);
	quiz.exit();
	expect(window.location.hash).toBe('#/study');
});

it('defers validation of a missing originating list to Bookmarks', async () => {
	flashcards.load('Deleted list', 'bookmarks');
	await vi.advanceTimersByTimeAsync(0);
	flashcards.exit();
	expect(window.location.hash).toBe('#/bookmarks?list=Deleted%20list');
});

it('preserves flashcard restoration and clears the index on explicit exit', async () => {
	flashcardsState.flashcardsActiveListStore.set('词 & # 1');
	flashcardsState.flashcardsActiveIndexStore.set(2);
	flashcardsState.flashcardsShowDetailsStore.set(true);
	flashcards.load('词 & # 1', 'bookmarks');
	await vi.advanceTimersByTimeAsync(0);
	expect(flashcards.activeIndex).toBe(2);
	expect(flashcards.showDetails).toBe(true);
	flashcards.exit();
	expect(flashcardsState.flashcardsActiveIndexStore.value).toBe(0);
	expect(flashcardsState.flashcardsShowDetailsStore.value).toBe(false);
});

it('resumes a newly selected list from its own reset state', async () => {
	flashcards.load('Alpha', 'bookmarks');
	await vi.advanceTimersByTimeAsync(0);
	flashcards.next();
	flashcards.next();
	flashcards.flip();
	flashcards.endSession();
	flashcards.load('Beta', 'bookmarks');
	await vi.advanceTimersByTimeAsync(0);
	expect(flashcards.activeIndex).toBe(0);
	expect(flashcards.showDetails).toBe(false);
	flashcards.endSession();
	flashcards.load(null, 'bookmarks');
	await vi.advanceTimersByTimeAsync(0);
	expect(flashcards.activeList).toBe('Beta');
	expect(flashcards.activeIndex).toBe(0);
	expect(flashcards.showDetails).toBe(false);
});

it('resumes the front of a card after moving away from a flipped card', async () => {
	flashcards.load('词 & # 1');
	await vi.advanceTimersByTimeAsync(0);
	flashcards.flip();
	flashcards.next();
	flashcards.endSession();
	flashcards.load(null);
	await vi.advanceTimersByTimeAsync(0);
	expect(flashcards.activeIndex).toBe(1);
	expect(flashcards.showDetails).toBe(false);
});

it('persists the clamped position when the resumed list has fewer words', async () => {
	flashcardsState.flashcardsActiveListStore.set('词 & # 1');
	flashcardsState.flashcardsActiveIndexStore.set(3);
	vi.mocked(bookmarksStore.getContent).mockResolvedValueOnce(words.slice(0, 2) as never);
	flashcards.load(null);
	await vi.advanceTimersByTimeAsync(0);
	expect(flashcards.activeIndex).toBe(1);
	expect(flashcardsState.flashcardsActiveIndexStore.value).toBe(1);
	flashcards.endSession();
	flashcards.load(null);
	await vi.advanceTimersByTimeAsync(0);
	expect(flashcards.activeIndex).toBe(1);
});

it('distinguishes a failed quiz read from a short list and can retry', async () => {
	vi.mocked(bookmarksStore.getContent).mockRejectedValueOnce(new Error('Storage unavailable'));
	quiz.start('词 & # 1', 'bookmarks');
	await vi.advanceTimersByTimeAsync(0);
	expect(quiz.error).toBe(true);
	expect(quiz.canStudyFlashcards).toBe(false);
	expect(quiz.unavailableMessage).toBe('Unable to start this quiz. Please try again.');
	quiz.retake();
	await vi.advanceTimersByTimeAsync(0);
	expect(quiz.error).toBe(false);
	expect(quiz.question).toEqual(question);
});

it('does not report picker loading or failure as an empty list', async () => {
	const picker = studyState.createStudyListState();
	expect(picker.status).toBe('loading');
	vi.mocked(bookmarksStore.getListSummaries).mockRejectedValueOnce(
		new Error('Storage unavailable')
	);
	await picker.load();
	expect(picker.status).toBe('error');
	await picker.load();
	expect(picker.status).toBe('ready');
	expect(picker.lists).toEqual([{ name: '词 & # 1', wordCount: 4 }]);
});

it('uses batched summaries to sort populated lists without fetching their contents', async () => {
	vi.mocked(bookmarksStore.getListSummaries).mockResolvedValueOnce([
		{ name: 'Zulu', wordCount: 4 },
		{ name: 'Empty', wordCount: 0 },
		{ name: 'Alpha', wordCount: 1 },
	]);
	const picker = studyState.createStudyListState();
	await picker.load();
	expect(picker.lists).toEqual([
		{ name: 'Alpha', wordCount: 1 },
		{ name: 'Zulu', wordCount: 4 },
	]);
	expect(bookmarksStore.getListSummaries).toHaveBeenCalledTimes(1);
	expect(bookmarksStore.getContent).not.toHaveBeenCalled();
});
