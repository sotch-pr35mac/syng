import { beforeEach, vi } from 'vitest';
import { act, fireEvent, render } from '@testing-library/svelte';
import DictionaryLink from '@/components/DictionaryContent/DictionaryLink.svelte';
import { dictionaryDisplaySettingsStore } from '@/stores/dictionaryDisplaySettings.svelte.js';
import { setPreferenceManagerForTest } from '@/utils/appServices.js';

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

it('is styled like a link', () => {
	const { getByTestId } = render(DictionaryLink, { link: 'A' });

	expect(getByTestId('dictionary-link').className.split(' ')).toContain('dictionary-link');
});

it('renders parenthetical character forms for the both preference', () => {
	const { getByLabelText, getByTestId, queryByText } = render(DictionaryLink, {
		link: '實驗',
		simplified: '实验',
		traditional: '實驗',
	});

	expect(getByLabelText('Simplified Chinese: 实验').textContent).toBe('实验');
	expect(getByLabelText('Traditional Chinese: 實驗').textContent).toBe('實驗');
	expect(getByTestId('dictionary-link-simplified').textContent).toBe('实验');
	expect(getByTestId('dictionary-link-traditional').textContent).toBe('實驗');
	expect(getByTestId('dictionary-link').textContent).toBe('实验（實驗）');
	expect(queryByText('简')).toBeNull();
	expect(queryByText('繁')).toBeNull();
	expect(getByTestId('dictionary-link').innerHTML).not.toContain('colored-characters--tone');
	expect(getComputedStyle(getByTestId('dictionary-link-simplified')).cursor).toBe('pointer');
	expect(getComputedStyle(getByLabelText('Simplified Chinese: 实验')).cursor).toBe('pointer');
});

it('renders identical character forms once without labels', () => {
	const { getByTestId, queryByLabelText, queryByTestId } = render(DictionaryLink, {
		link: '中国',
		simplified: '中国',
		traditional: '中国',
	});

	expect(getByTestId('dictionary-link-simplified').textContent).toBe('中国');
	expect(queryByTestId('dictionary-link-traditional')).toBeNull();
	expect(queryByLabelText('Simplified Chinese')).toBeNull();
	expect(queryByLabelText('Traditional Chinese')).toBeNull();
});

it('renders only the selected character form', () => {
	dictionaryDisplaySettingsStore.setCharacterSet('traditional');
	const { getByTestId, queryByTestId } = render(DictionaryLink, {
		link: '實驗',
		simplified: '实验',
		traditional: '實驗',
	});

	expect(getByTestId('dictionary-link-traditional').textContent).toBe('實驗');
	expect(queryByTestId('dictionary-link-simplified')).toBeNull();
});

it('updates a mounted link immediately when the preference changes', async () => {
	const { getByTestId, queryByTestId } = render(DictionaryLink, {
		link: '實驗',
		simplified: '实验',
		traditional: '實驗',
	});

	await act(() => dictionaryDisplaySettingsStore.setCharacterSet('simplified'));

	expect(getByTestId('dictionary-link-simplified').textContent).toBe('实验');
	expect(queryByTestId('dictionary-link-traditional')).toBeNull();
});

it('dispatches the unchanged lookup text and anchor when clicked', async () => {
	const onopen = vi.fn();
	const { getByTestId } = render(DictionaryLink, {
		link: '實驗',
		simplified: '实验',
		traditional: '實驗',
		onopen,
	});
	const link = getByTestId('dictionary-link');
	const anchor = new DOMRect(10, 20, 30, 40);
	vi.spyOn(link, 'getBoundingClientRect').mockReturnValue(anchor);

	await fireEvent.click(link);

	expect(onopen).toHaveBeenCalledWith({
		detail: {
			text: '實驗',
			anchor,
		},
	});
});
