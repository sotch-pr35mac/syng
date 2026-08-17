import { beforeEach, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import MeasureWord from '@/components/DictionaryContent/MeasureWord.svelte';
import { dictionaryDisplaySettingsStore } from '@/stores/dictionaryDisplaySettings.svelte.js';
import { setPreferenceManagerForTest } from '@/utils/appServices.js';

const IDENTICAL_MEASURE_WORD = { simplified: '个', traditional: '个' };
const DIFFERENT_MEASURE_WORD = { simplified: '只', traditional: '隻' };

beforeEach(async () => {
	const preferences = {
		characterSet: 'both',
		colorCharactersByTone: true,
		colorPinyinByTone: false,
	};
	setPreferenceManagerForTest({
		waitForInit: vi.fn(() => Promise.resolve()),
		get: vi.fn((name) => preferences[name]),
		set: vi.fn((name, value) => {
			preferences[name] = value;
		}),
	});
	await dictionaryDisplaySettingsStore.loadSettings();
});

it('renders matching forms once as a dictionary link', () => {
	const { getByTestId, queryByLabelText } = render(MeasureWord, {
		value: IDENTICAL_MEASURE_WORD,
	});

	expect(getByTestId('dictionary-link-simplified').textContent).toBe('个');
	expect(queryByLabelText('Simplified Chinese')).toBeNull();
});

it('renders parenthetical forms for the both preference', () => {
	const { getByLabelText, getByTestId, queryByText } = render(MeasureWord, {
		value: DIFFERENT_MEASURE_WORD,
	});

	expect(getByLabelText('Simplified Chinese: 只').textContent).toBe('只');
	expect(getByLabelText('Traditional Chinese: 隻').textContent).toBe('隻');
	expect(getByTestId('dictionary-link-simplified').textContent).toBe('只');
	expect(getByTestId('dictionary-link-traditional').textContent).toBe('隻');
	expect(getByTestId('dictionary-link').textContent).toBe('只（隻）');
	expect(queryByText('简')).toBeNull();
	expect(queryByText('繁')).toBeNull();
});

it.each([
	['simplified', 'dictionary-link-simplified', '只'],
	['traditional', 'dictionary-link-traditional', '隻'],
])('renders the %s preference', (characterSet, testId, expected) => {
	dictionaryDisplaySettingsStore.setCharacterSet(characterSet);
	const { getByTestId } = render(MeasureWord, { value: DIFFERENT_MEASURE_WORD });

	expect(getByTestId(testId).textContent).toBe(expected);
	expect(getByTestId('dictionary-link').innerHTML).not.toContain('colored-characters--tone');
});
