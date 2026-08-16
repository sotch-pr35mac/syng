import { beforeEach, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/svelte';
import EntryTopline from '@/components/DictionaryContent/EntryTopline.svelte';
import { dictionaryDisplaySettingsStore } from '@/stores/dictionaryDisplaySettings.svelte.js';
import { setPreferenceManagerForTest } from '@/utils/appServices.js';

const TEST_WORD_DIFFERENT = {
	simplified: 'AB',
	traditional: 'CD',
	tone_marks: [1, 2],
	pinyin_marks: 'ac1 bd2',
};
const TEST_WORD_IDENTICAL = {
	simplified: 'AB',
	traditional: 'AB',
	tone_marks: [1, 2],
	pinyin_marks: 'a1 b2',
};

let preferenceManager;

beforeEach(async () => {
	const preferences = {
		characterSet: 'both',
		colorCharactersByTone: true,
		colorPinyinByTone: false,
	};
	preferenceManager = {
		waitForInit: vi.fn(() => Promise.resolve()),
		get: vi.fn((name) => preferences[name]),
		set: vi.fn((name, value) => {
			preferences[name] = value;
		}),
	};
	setPreferenceManagerForTest(preferenceManager);
	await dictionaryDisplaySettingsStore.loadSettings();
});

it('renders neutral pinyin with its existing container styling', () => {
	const { container } = render(EntryTopline, { word: TEST_WORD_IDENTICAL });
	const pinyin = container.querySelector('.chinese-characters--pinyin-container');

	expect(pinyin.textContent).toBe('a1 b2');
	expect(pinyin.children).toHaveLength(0);
	expect(pinyin.querySelector('.colored-pinyin--tone-1')).toBeNull();
});

it('renders labeled simplified and traditional forms without parentheses', () => {
	const { getByLabelText, getByTestId } = render(EntryTopline, {
		word: TEST_WORD_DIFFERENT,
	});

	expect(getByLabelText('Simplified Chinese').textContent).toBe('简');
	expect(getByLabelText('Traditional Chinese').textContent).toBe('繁');
	expect(getByTestId('lexical-simplified').textContent).toBe('AB');
	expect(getByTestId('lexical-traditional').textContent).toBe('CD');
	expect(getByTestId('chinese-characters').textContent).not.toMatch(/[()]/);
});

it('keeps writing-system labels outside selectable lexical content', () => {
	const { getByLabelText, getByTestId } = render(EntryTopline, {
		word: TEST_WORD_DIFFERENT,
	});
	const simplifiedLabel = getByLabelText('Simplified Chinese');
	const simplifiedLexical = getByTestId('lexical-simplified');

	expect(simplifiedLexical.contains(simplifiedLabel)).toBe(false);
	expect(simplifiedLexical.textContent).toBe('AB');
	expect(getComputedStyle(simplifiedLabel).userSelect).toBe('none');
});

it('uses the existing separate-traditional hint only to stack forms', () => {
	const { getByTestId } = render(EntryTopline, {
		word: TEST_WORD_DIFFERENT,
		separateTraditionalCharacters: true,
	});

	expect(getByTestId('chinese-characters').className.split(' ')).toContain(
		'chinese-characters--character-container--stacked'
	);
	expect(getByTestId('lexical-simplified').textContent).toBe('AB');
	expect(getByTestId('lexical-traditional').textContent).toBe('CD');
});

it('renders identical forms once without labels', () => {
	const { getByTestId, queryByLabelText } = render(EntryTopline, {
		word: TEST_WORD_IDENTICAL,
	});

	expect(getByTestId('lexical-simplified').textContent).toBe('AB');
	expect(queryByLabelText('Simplified Chinese')).toBeNull();
	expect(queryByLabelText('Traditional Chinese')).toBeNull();
});

it('renders only simplified characters when selected', () => {
	dictionaryDisplaySettingsStore.setCharacterSet('simplified');
	const { getByTestId, queryByTestId } = render(EntryTopline, {
		word: TEST_WORD_DIFFERENT,
	});

	expect(getByTestId('lexical-simplified').textContent).toBe('AB');
	expect(queryByTestId('lexical-traditional')).toBeNull();
});

it('renders only traditional characters when selected', () => {
	dictionaryDisplaySettingsStore.setCharacterSet('traditional');
	const { getByTestId, queryByTestId } = render(EntryTopline, {
		word: TEST_WORD_DIFFERENT,
	});

	expect(getByTestId('lexical-traditional').textContent).toBe('CD');
	expect(queryByTestId('lexical-simplified')).toBeNull();
});

it('updates an already-mounted entry immediately when the character preference changes', async () => {
	const { getByTestId, queryByTestId } = render(EntryTopline, {
		word: TEST_WORD_DIFFERENT,
	});

	await act(() => dictionaryDisplaySettingsStore.setCharacterSet('traditional'));

	expect(getByTestId('lexical-traditional').textContent).toBe('CD');
	expect(queryByTestId('lexical-simplified')).toBeNull();
});

it.each([
	{ characters: true, pinyin: false },
	{ characters: true, pinyin: true },
	{ characters: false, pinyin: true },
	{ characters: false, pinyin: false },
])(
	'keeps character and pinyin coloring independent: $characters / $pinyin',
	({ characters, pinyin }) => {
		dictionaryDisplaySettingsStore.setCharacterSet('simplified');
		dictionaryDisplaySettingsStore.setColorCharactersByTone(characters);
		dictionaryDisplaySettingsStore.setColorPinyinByTone(pinyin);
		const { container } = render(EntryTopline, { word: TEST_WORD_DIFFERENT });

		expect(Boolean(container.querySelector('.colored-characters--tone-1'))).toBe(characters);
		expect(Boolean(container.querySelector('.colored-pinyin--tone-1'))).toBe(pinyin);
	}
);
