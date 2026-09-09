import { beforeEach, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/svelte';
import ChinesePreferencesPreview from '@/components/Onboarding/ChinesePreferencesPreview.svelte';
import { dictionaryDisplaySettingsStore } from '@/stores/dictionaryDisplaySettings.svelte.js';
import { setPreferenceManagerForTest } from '@/utils/appServices.js';

const preferences: Record<string, unknown> = {};

beforeEach(async () => {
	Object.assign(preferences, {
		characterSet: 'both',
		colorCharactersByTone: true,
		colorPinyinByTone: false,
		colorListsByTone: false,
		hskVariant: 'hsk_exam_syllabus_2025',
	});
	setPreferenceManagerForTest({
		waitForInit: vi.fn(() => Promise.resolve()),
		get: vi.fn((name: string) => preferences[name]),
		set: vi.fn((name: string, value: unknown) => {
			preferences[name] = value;
		}),
	} as never);
	await dictionaryDisplaySettingsStore.loadSettings();
});

it('assigns the correct tone color to each pinyin syllable', () => {
	dictionaryDisplaySettingsStore.setColorPinyinByTone(true);
	const preview = render(ChinesePreferencesPreview);

	expect(
		preview.container.querySelector('.chinese-preview__pinyin .colored-pinyin--tone-4')
			?.textContent
	).toBe('hàn');
	expect(
		preview.container.querySelector('.chinese-preview__pinyin .colored-pinyin--tone-3')
			?.textContent
	).toBe('yǔ');
});

it('includes a list-result preview that follows list tone coloring', () => {
	const uncolored = render(ChinesePreferencesPreview);
	expect(uncolored.getByText('List result')).toBeTruthy();
	expect(uncolored.getByText('Chinese language')).toBeTruthy();
	expect(
		uncolored.container.querySelector(
			'.chinese-preview__list [class*="colored-characters--tone"]'
		)
	).toBeNull();
	uncolored.unmount();

	dictionaryDisplaySettingsStore.setColorListsByTone(true);
	const colored = render(ChinesePreferencesPreview);
	expect(
		colored.container.querySelector(
			'.chinese-preview__list [class*="colored-characters--tone"]'
		)
	).toBeTruthy();
});

it('previews the selected HSK variant and hides the tag when HSK is disabled', async () => {
	const preview = render(ChinesePreferencesPreview);
	const tag = preview.getByText('HSK: 1').closest('.sy-tag');

	expect(tag?.getAttribute('title')).toBe('HSK Exam Syllabus 2025');
	expect(tag?.closest('.chinese-preview__word')).toBeTruthy();
	expect(tag?.closest('.chinese-preview__list')).toBeNull();

	dictionaryDisplaySettingsStore.setHskVariant('hsk_2015');
	await waitFor(() => expect(tag?.getAttribute('title')).toBe('HSK 2015'));

	dictionaryDisplaySettingsStore.setHskVariant('none');
	await waitFor(() => expect(preview.queryByText(/^HSK:/)).toBeNull());
});
