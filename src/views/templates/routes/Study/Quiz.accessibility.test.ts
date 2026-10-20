import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import Quiz from '@/routes/Study/Quiz.svelte';
import MobileStudyQuiz from '@/routes/mobile/Study/MobileStudyQuiz.svelte';

const { quizState } = vi.hoisted(() => ({
	quizState: {
		showResult: true,
		showAnswer: false,
		showFinalResults: false,
		lastAnswerCorrect: true,
		questionsCompleted: 0,
		questionsTotal: 1,
		lists: [],
		start: vi.fn(),
		endSession: vi.fn(),
		exit: vi.fn(),
		continue: vi.fn(),
		answerQuestion: vi.fn().mockResolvedValue(false),
	},
}));

vi.mock('@/composables/quiz.svelte.js', () => ({ quizRoute: quizState }));
vi.mock('@tauri-apps/plugin-os', () => ({ platform: () => 'macos' }));
vi.mock('@/components/DictionaryPopover/DictionaryPopover.svelte', async () => ({
	default: (await import('@/components/__mocks__/RouteMock.svelte')).default,
}));

beforeEach(() => {
	vi.clearAllMocks();
	Element.prototype.animate = vi.fn().mockReturnValue({
		finished: Promise.resolve(),
		cancel: vi.fn(),
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
	});
});

it.each([
	['desktop', Quiz],
	['mobile', MobileStudyQuiz],
] as const)(
	'%s quiz reserves the page pause shortcut for pointer clicks',
	async (_name, component) => {
		const user = userEvent.setup();
		const { getByRole } = render(component);
		const region = getByRole('region', { name: 'Quiz content' });
		// The region contains dictionary actions and quiz choices in the live route.
		const nestedAction = document.createElement('button');
		nestedAction.textContent = 'Nested study action';
		region.append(nestedAction);
		nestedAction.focus();
		await user.keyboard('{Enter}');
		await user.keyboard(' ');
		expect(getByRole('button', { name: 'Pause timer' })).toBeTruthy();
		await fireEvent.click(region, { detail: 1 });
		expect(getByRole('button', { name: 'Resume timer' })).toBeTruthy();
		await user.click(getByRole('button', { name: 'Resume timer' }));
		expect(getByRole('button', { name: 'Pause timer' })).toBeTruthy();
	}
);
