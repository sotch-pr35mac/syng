import { beforeEach, expect, it, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import PreferredCharacters from '@/components/DictionaryContent/PreferredCharacters.svelte';
import { dictionaryDisplaySettingsStore } from '@/stores/dictionaryDisplaySettings.svelte.js';
import { setPreferenceManagerForTest } from '@/utils/appServices.js';

beforeEach(async () => {
	const preferences: Record<string, unknown> = {
		characterSet: 'both',
		colorCharactersByTone: true,
		colorPinyinByTone: false,
		colorListsByTone: false,
	};
	setPreferenceManagerForTest({
		waitForInit: vi.fn(() => Promise.resolve()),
		get: vi.fn((name: string) => preferences[name]),
		set: vi.fn(),
	} as never);
	await dictionaryDisplaySettingsStore.loadSettings();
});

it('renders both inline forms as one selectable full-width parenthetical string', () => {
	const { container, getByLabelText, queryByText } = render(PreferredCharacters, {
		simplified: '实验',
		traditional: '實驗',
		variant: 'inline',
		lexicalTestIdPrefix: 'inline',
	});
	const lexicalDisplay = container.querySelector('.preferred-characters__inline-lexical');

	expect(lexicalDisplay?.textContent).toBe('实验（實驗）');
	expect(lexicalDisplay?.classList).toContain('sy-text--selectable');
	expect(getByLabelText('Simplified Chinese: 实验').getAttribute('lang')).toBe('zh-Hans');
	expect(getByLabelText('Traditional Chinese: 實驗').getAttribute('lang')).toBe('zh-Hant');
	expect(queryByText('简')).toBeNull();
	expect(queryByText('繁')).toBeNull();
});

it('keeps labels and separate forms in the display variant', () => {
	const { container, getByLabelText } = render(PreferredCharacters, {
		simplified: '实验',
		traditional: '實驗',
		variant: 'display',
	});

	expect(getByLabelText('Simplified Chinese').textContent).toBe('简');
	expect(getByLabelText('Traditional Chinese').textContent).toBe('繁');
	expect(container.textContent).not.toContain('（');
	expect(container.textContent).not.toContain('）');
});

it('renders identical inline forms once without parentheses or labels', () => {
	const { container, queryByLabelText } = render(PreferredCharacters, {
		simplified: '中国',
		traditional: '中国',
		variant: 'inline',
	});
	const lexicalDisplay = container.querySelector('.preferred-characters__lexical');

	expect(lexicalDisplay?.textContent).toBe('中国');
	expect(queryByLabelText(/Chinese/)).toBeNull();
});

it('colors both inline lexical forms while leaving parentheses unwrapped', () => {
	const { container } = render(PreferredCharacters, {
		simplified: '实验',
		traditional: '實驗',
		tones: [2, 4],
		colorByTone: true,
		variant: 'inline',
	});

	expect(container.textContent).toBe('实验（實驗）');
	expect(container.querySelectorAll('.colored-characters--tone-2')).toHaveLength(2);
	expect(container.querySelectorAll('.colored-characters--tone-4')).toHaveLength(2);
	expect(container.querySelectorAll('.preferred-characters__inline-lexical > span')).toHaveLength(
		2
	);
});
