import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { telemetry } from '@/utils/index.js';
import { bookmarksStore } from '@/stores/bookmarks.svelte.js';
import { NATIVE_COMMANDS } from '@/types/nativeCommands.js';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('@/utils/index.js', () => ({
	handleError: vi.fn(),
	telemetry: { trackEvent: vi.fn(() => Promise.resolve()) },
}));
vi.mock('@/stores/bookmarks.svelte.js', () => ({
	bookmarksStore: { getContent: vi.fn(), lists: [] },
}));

let flashcards: typeof import('@/composables/flashcards.svelte.js').flashcardsRoute;
let quiz: typeof import('@/composables/quiz.svelte.js').quizRoute;
const words = Array.from({ length: 4 }, (_unused, index) => ({
	lexical_id: `1:word-${index}`,
	id: `1:word-${index}`,
}));
const question = {
	question: {
		MultipleChoice: {
			kind: 'English',
			question: 'private',
			time_limit: 10,
			lexical_unit: words[0],
		},
	},
	completed: 0,
	pending: 1,
};
const events = (name: string) =>
	vi.mocked(telemetry.trackEvent).mock.calls.filter(([eventName]) => eventName === name);

beforeEach(async () => {
	vi.useFakeTimers();
	vi.resetModules();
	vi.mocked(telemetry.trackEvent).mockClear();
	vi.mocked(bookmarksStore.getContent).mockReset();
	vi.mocked(bookmarksStore.getContent).mockResolvedValue(words as never);
	vi.mocked(invoke).mockReset();
	vi.mocked(invoke).mockImplementation(async (command) => {
		if (command === NATIVE_COMMANDS.QUIZ.NEXT_QUESTION) {
			return question;
		}
		if (command === NATIVE_COMMANDS.QUIZ.ANSWER) {
			return { correct: true, question: question.question };
		}
		if (command === NATIVE_COMMANDS.QUIZ.SCORE) {
			return { total: 1, correct: 1, score: 1 };
		}
		return [];
	});
	flashcards = (await import('@/composables/flashcards.svelte.js')).flashcardsRoute;
	quiz = (await import('@/composables/quiz.svelte.js')).quizRoute;
});
afterEach(() => {
	flashcards.endSession();
	quiz.endSession();
	vi.useRealTimers();
});

it('summarizes unique cards viewed and revealed without per-card events', async () => {
	flashcards.load('Private list');
	await vi.advanceTimersByTimeAsync(0);
	flashcards.flip();
	flashcards.next();
	flashcards.flip();
	flashcards.previous();
	flashcards.flip();
	flashcards.endSession();
	flashcards.endSession();
	expect(events('flashcards.started')).toHaveLength(1);
	expect(events('flashcards.session_ended')).toEqual([
		['flashcards.session_ended', { viewed_count: 2, revealed_count: 2 }],
	]);
	expect(telemetry.trackEvent).toHaveBeenCalledTimes(2);
	expect(JSON.stringify(vi.mocked(telemetry.trackEvent).mock.calls)).not.toMatch(
		/Private list|word-/
	);
});

it('does not start empty or unmounted flashcard sessions', async () => {
	vi.mocked(bookmarksStore.getContent).mockResolvedValueOnce([]);
	flashcards.load('Empty');
	await vi.advanceTimersByTimeAsync(0);
	expect(events('flashcards.started')).toHaveLength(0);
	flashcards.load('Pending');
	flashcards.endSession();
	await vi.advanceTimersByTimeAsync(0);
	expect(events('flashcards.started')).toHaveLength(0);
});

it('records quiz start and completion once despite duplicate async callbacks', async () => {
	quiz.start('Private list');
	quiz.start('Private list');
	await vi.advanceTimersByTimeAsync(0);
	expect(events('quiz.started')).toHaveLength(1);
	const firstAnswer = quiz.answerQuestion('private response');
	await expect(quiz.answerQuestion('private response')).resolves.toBe(false);
	await firstAnswer;
	quiz.continue();
	quiz.continue();
	await vi.advanceTimersByTimeAsync(0);
	quiz.endSession();
	expect(events('quiz.completed')).toEqual([
		['quiz.completed', { question_count: 1, correct_count: 1, score: 1 }],
	]);
	expect(events('quiz.abandoned')).toHaveLength(0);
	expect(JSON.stringify(vi.mocked(telemetry.trackEvent).mock.calls)).not.toMatch(
		/Private list|private response|word-/
	);
});

it('records abandonment only for a started, unfinished quiz', async () => {
	quiz.start('Private list');
	await vi.advanceTimersByTimeAsync(0);
	await quiz.answerQuestion('response');
	quiz.endSession();
	quiz.endSession();
	expect(events('quiz.abandoned')).toEqual([['quiz.abandoned', { answered_count: 1 }]]);
	quiz.start('Never loaded');
	quiz.endSession();
	await vi.advanceTimersByTimeAsync(0);
	expect(events('quiz.started')).toHaveLength(1);
});
