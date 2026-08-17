import { beforeEach, expect, it, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import DictionaryListPreviewContent from '@/components/SyList/DictionaryListPreviewContent.svelte';
import { dictionaryDisplaySettingsStore } from '@/stores/dictionaryDisplaySettings.svelte.js';
import { setPreferenceManagerForTest } from '@/utils/appServices.js';

const word = {
	word_id: 1,
	hash: 'experiment',
	simplified: '实验',
	traditional: '實驗',
	pinyin_marks: 'shí yàn',
	tone_marks: [2, 4],
	english: ['experiment'],
	measure_words: [],
};

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
		set: vi.fn((name: string, value: unknown) => {
			preferences[name] = value;
		}),
	} as never);
	await dictionaryDisplaySettingsStore.loadSettings();
});

it('uses parenthetical preferred forms while keeping list text neutral by default', () => {
	const { container, getByLabelText, getByText, queryByText } = render(
		DictionaryListPreviewContent,
		{
			value: { word },
		}
	);

	expect(getByLabelText('Simplified Chinese: 实验').textContent).toBe('实验');
	expect(getByLabelText('Traditional Chinese: 實驗').textContent).toBe('實驗');
	expect(getByText('实验')).toBeTruthy();
	expect(getByText('實驗')).toBeTruthy();
	expect(container.textContent).toContain('实验（實驗）');
	expect(queryByText('简')).toBeNull();
	expect(queryByText('繁')).toBeNull();
	expect(container.querySelector('[class*="colored-characters--tone"]')).toBeNull();
	expect(container.querySelector('[class*="colored-pinyin--tone"]')).toBeNull();
});

it('uses the selected character set in a mobile preview', () => {
	dictionaryDisplaySettingsStore.setCharacterSet('traditional');
	const { getByText, queryByText } = render(DictionaryListPreviewContent, {
		value: { word },
		mobile: true,
	});

	expect(getByText('實驗')).toBeTruthy();
	expect(queryByText('实验')).toBeNull();
});

it.each([
	{
		master: false,
		characters: true,
		pinyin: true,
		coloredCharacters: false,
		coloredPinyin: false,
	},
	{
		master: true,
		characters: true,
		pinyin: false,
		coloredCharacters: true,
		coloredPinyin: false,
	},
	{
		master: true,
		characters: false,
		pinyin: true,
		coloredCharacters: false,
		coloredPinyin: true,
	},
	{ master: true, characters: true, pinyin: true, coloredCharacters: true, coloredPinyin: true },
	{
		master: true,
		characters: false,
		pinyin: false,
		coloredCharacters: false,
		coloredPinyin: false,
	},
])(
	'applies the list gate: $master / $characters / $pinyin',
	({ master, characters, pinyin, coloredCharacters, coloredPinyin }) => {
		dictionaryDisplaySettingsStore.setCharacterSet('simplified');
		dictionaryDisplaySettingsStore.setColorListsByTone(master);
		dictionaryDisplaySettingsStore.setColorCharactersByTone(characters);
		dictionaryDisplaySettingsStore.setColorPinyinByTone(pinyin);
		const { container } = render(DictionaryListPreviewContent, { value: { word } });

		expect(Boolean(container.querySelector('.colored-characters--tone-2'))).toBe(
			coloredCharacters
		);
		expect(Boolean(container.querySelector('.colored-pinyin--tone-2'))).toBe(coloredPinyin);
	}
);
