import { DEFAULT_READER_SETTINGS } from '@/reader/settings/defaults.js';
import type { ReaderThemeSettings } from '@/reader/types.js';

let settings = $state<ReaderThemeSettings>({ ...DEFAULT_READER_SETTINGS });

function updateSettings(patch: Partial<ReaderThemeSettings>): void {
	settings = {
		...settings,
		...patch,
	};
}

function resetSettings(): void {
	settings = { ...DEFAULT_READER_SETTINGS };
}

export const readerSettingsStore = {
	get settings(): ReaderThemeSettings {
		return settings;
	},
	updateSettings,
	resetSettings,
};
