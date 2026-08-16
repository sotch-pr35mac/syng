import { beforeEach, expect, it, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import QuizResults from '@/components/QuizResults/QuizResults.svelte';
import { dictionaryDisplaySettingsStore } from '@/stores/dictionaryDisplaySettings.svelte.js';
import { setPreferenceManagerForTest } from '@/utils/appServices.js';

beforeEach(async () => {
	const preferences: Record<string, unknown> = {
		characterSet: 'both',
		colorCharactersByTone: true,
		colorPinyinByTone: true,
		colorListsByTone: true,
	};
	setPreferenceManagerForTest({
		waitForInit: vi.fn(() => Promise.resolve()),
		get: vi.fn((name: string) => preferences[name]),
		set: vi.fn(),
	} as never);
	await dictionaryDisplaySettingsStore.loadSettings();
});

it('uses parenthetical inline forms for quiz questions and character answers', () => {
	const question = {
		kind: 'Characters',
		question: '苹果 (蘋果)',
		answer: 'píng guǒ',
		options: [{ value: 'píng guǒ' }, { value: 'lí' }],
		time_limit: 10,
		word_data: {
			simplified: '苹果',
			traditional: '蘋果',
		} as never,
	};
	const characterAnswerQuestion = {
		kind: 'English',
		question: 'experiment',
		answer: '实验 (實驗)',
		options: [
			{
				value: '实验 (實驗)',
				characters: { simplified: '实验', traditional: '實驗' },
			},
			{
				value: '苹果 (蘋果)',
				characters: { simplified: '苹果', traditional: '蘋果' },
			},
		],
		time_limit: 10,
		word_data: {} as never,
	};
	const { container, getAllByText } = render(QuizResults, {
		score: 0,
		correct: 0,
		total: 2,
		incorrect: [
			{ response: 'lí', question: { MultipleChoice: question } },
			{ response: '苹果 (蘋果)', question: { MultipleChoice: characterAnswerQuestion } },
		],
	});

	expect(getAllByText('蘋果').length).toBeGreaterThan(0);
	expect(getAllByText('實驗').length).toBeGreaterThan(0);
	expect(container.textContent).toContain('苹果（蘋果）');
	expect(container.textContent).toContain('实验（實驗）');
	expect(container.innerHTML).not.toContain('colored-characters--tone');
});
