import { beforeEach, expect, it, vi } from 'vitest';
import { render } from '@testing-library/svelte';
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
