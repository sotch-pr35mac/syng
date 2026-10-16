import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import MobileSearch from '@/routes/mobile/MobileSearch.svelte';
import MobileStudyQuiz from '@/routes/mobile/Study/MobileStudyQuiz.svelte';
import { walkthroughStore } from '@/stores/walkthrough.svelte.js';
import { searchStore } from '@/composables/search.svelte.js';
import { mobileSearchSnapStore } from '@/stores/mobileSearch.svelte.js';
import { setBookmarkManagerForTest, setPreferenceManagerForTest } from '@/utils/appServices.js';
import { createWalkthroughPreferences } from '@/types/walkthrough.js';
import { mockBookmarkManager } from '@test/utils/unitTestUtils.js';

const quiz = vi.hoisted(() => ({ answerQuestion: vi.fn(async () => false) }));
vi.mock('@/composables/quiz.svelte.js', () => ({
	quizRoute: {
		...quiz,
		start: () => {},
		endSession: () => {},
		setInstructionPaused: () => {},
		currentQuestion: { kind: 'English', question: 'learn', options: [] },
		question: {},
		showQuestionTimer: true,
		questionDuration: 1,
		questionsCompleted: 0,
		questionsTotal: 1,
		lists: [],
	},
}));

vi.mock('@tauri-apps/plugin-os', () => ({ platform: () => 'ios' }));
vi.mock('@tauri-apps/api/core', () => ({
	invoke: vi.fn(async () => [
		{
			id: '1:learning',
			simplified: '学习',
			traditional: '學習',
			english: ['learn'],
			pinyin_marks: 'xué xí',
			tone_marks: [2, 2],
			measure_words: [],
		},
	]),
}));
vi.mock('@/utils/telemetry.js', () => ({ telemetry: { trackEvent: async () => {} } }));
vi.mock('@/components/Walkthrough/walkthroughContent.js', () => ({
	prepareGuide: async () => ({
		context: {},
		steps: [
			{ id: 'search', target: 'search-field', route: '/' },
			{ id: 'save', target: 'dictionary-save', route: '/' },
		],
	}),
}));

beforeEach(() => {
	setBookmarkManagerForTest(mockBookmarkManager({ words: [], lists: ['Bookmarks'] }) as never);
	setPreferenceManagerForTest({
		waitForInit: async () => {},
		get: () => createWalkthroughPreferences(),
		set: () => {},
	} as never);
	mobileSearchSnapStore.set('full');
});
afterEach(() => {
	walkthroughStore.interrupt();
	searchStore.cancelPendingTelemetry();
	vi.useRealTimers();
});

it('reveals the appropriate mobile surface for each step and permits manual interaction afterward', async () => {
	await searchStore.prepareWalkthroughExample(() => true);
	render(MobileSearch);
	await walkthroughStore.start('app');
	await tick();
	expect(mobileSearchSnapStore.value).toBe('partial');
	walkthroughStore.next();
	await tick();
	expect(mobileSearchSnapStore.value).toBe('collapsed');
	walkthroughStore.skip();
	await fireEvent.focusIn(screen.getByPlaceholderText('Search...'));
	expect(mobileSearchSnapStore.value).toBe('partial');
});

it('resumes a running quiz timer after help closes instead of leaving it manually paused', async () => {
	vi.useFakeTimers();
	quiz.answerQuestion.mockClear();
	render(MobileStudyQuiz);
	await fireEvent.click(screen.getByRole('button', { name: 'Show me how' }));
	await vi.advanceTimersByTimeAsync(2000);
	expect(quiz.answerQuestion).not.toHaveBeenCalled();
	walkthroughStore.skip();
	await tick();
	await vi.advanceTimersByTimeAsync(1100);
	expect(quiz.answerQuestion).toHaveBeenCalledWith('N/A');
});
