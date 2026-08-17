import { beforeEach, expect, it, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import CharacterSetSelector from '@/components/SettingsOption/CharacterSetSelector.svelte';
import { dictionaryDisplaySettingsStore } from '@/stores/dictionaryDisplaySettings.svelte.js';
import { setPreferenceManagerForTest } from '@/utils/appServices.js';

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

it('exposes the character choices as one named radio group', () => {
	const { getByRole, getAllByRole } = render(CharacterSetSelector);

	expect(getByRole('group', { name: 'Characters' })).toBeTruthy();
	expect(getAllByRole('radio')).toHaveLength(3);
	expect(getByRole('radio', { name: 'Simplified + Traditional' }).checked).toBe(true);
});
