import { beforeEach, expect, it, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import DictionaryMetadataSettings from '@/components/SettingsOption/DictionaryMetadataSettings.svelte';
import { dictionaryDisplaySettingsStore } from '@/stores/dictionaryDisplaySettings.svelte.js';
import { setPreferenceManagerForTest } from '@/utils/appServices.js';

beforeEach(async () => {
	const preferences = {
		showQualifiers: true,
		showPartsOfSpeech: true,
		showAlternativePronunciations: false,
	};
	setPreferenceManagerForTest({
		waitForInit: vi.fn(() => Promise.resolve()),
		get: vi.fn((name) => preferences[name]),
		set: vi.fn((name, value) => {
			preferences[name] = value;
		}),
	} as never);
	await dictionaryDisplaySettingsStore.loadSettings();
});

it('renders the metadata options with the requested defaults', () => {
	const { getByLabelText } = render(DictionaryMetadataSettings);

	expect((getByLabelText('Show qualifiers') as HTMLInputElement).checked).toBe(true);
	expect((getByLabelText('Show parts of speech') as HTMLInputElement).checked).toBe(true);
	expect((getByLabelText('Show alternative pronunciations') as HTMLInputElement).checked).toBe(
		false
	);
});
