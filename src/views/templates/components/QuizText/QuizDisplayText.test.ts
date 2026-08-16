import { beforeEach, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/svelte';
import QuizDisplayText from '@/components/QuizText/QuizDisplayText.svelte';
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

it('renders preferred character forms without tone coloring', () => {
	const { container, getByLabelText, getByText } = render(QuizDisplayText, {
		text: '实验 (實驗)',
		characters: { simplified: '实验', traditional: '實驗' },
		variant: 'display',
	});

	expect(getByLabelText('Simplified Chinese')).toBeTruthy();
	expect(getByLabelText('Traditional Chinese')).toBeTruthy();
	expect(getByText('实验')).toBeTruthy();
	expect(getByText('實驗')).toBeTruthy();
	expect(container.innerHTML).not.toContain('colored-characters--tone');
	expect(container.textContent).not.toContain('(');
});

it('renders both inline forms as one parenthetical display', () => {
	const { container, getByLabelText, queryByText } = render(QuizDisplayText, {
		text: '实验 (實驗)',
		characters: { simplified: '实验', traditional: '實驗' },
		variant: 'inline',
	});

	expect(container.textContent).toBe('实验（實驗）');
	expect(getByLabelText('Simplified Chinese: 实验')).toBeTruthy();
	expect(getByLabelText('Traditional Chinese: 實驗')).toBeTruthy();
	expect(queryByText('简')).toBeNull();
	expect(queryByText('繁')).toBeNull();
	expect(container.innerHTML).not.toContain('colored-characters--tone');
});

it('reacts to a character preference change', async () => {
	const { getByText, queryByText } = render(QuizDisplayText, {
		text: '实验 (實驗)',
		characters: { simplified: '实验', traditional: '實驗' },
	});

	await act(() => dictionaryDisplaySettingsStore.setCharacterSet('traditional'));

	expect(getByText('實驗')).toBeTruthy();
	expect(queryByText('实验')).toBeNull();
});

it('leaves non-character quiz text unchanged', () => {
	const { getByText } = render(QuizDisplayText, { text: 'experiment' });

	expect(getByText('experiment')).toBeTruthy();
});
