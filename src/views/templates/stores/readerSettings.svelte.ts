import {
	DEFAULT_READER_SETTINGS,
	getReaderColorThemeSettings,
	READER_COLOR_THEMES,
	READER_FONT_SIZE_MAX_PERCENT,
	READER_FONT_SIZE_MIN_PERCENT,
	READER_FONT_SIZE_STEP_PERCENT,
} from '@/reader/settings/defaults.js';
import type { ReaderColorThemeId, ReaderThemeSettings } from '@/reader/types.js';
import { getPreferenceManager } from '@/utils/appServices.js';

const READER_SETTINGS_PREFERENCE_KEY = 'readerSettings';

let settings = $state<ReaderThemeSettings>({ ...DEFAULT_READER_SETTINGS });

function isReaderColorThemeId(value: unknown): value is ReaderColorThemeId {
	return READER_COLOR_THEMES.some((theme) => theme.id === value);
}

function clampFontSizePercent(value: unknown): number {
	const numericValue =
		typeof value === 'number' ? value : DEFAULT_READER_SETTINGS.fontSizePercent;
	if (!Number.isFinite(numericValue)) {
		return DEFAULT_READER_SETTINGS.fontSizePercent;
	}
	return Math.min(
		READER_FONT_SIZE_MAX_PERCENT,
		Math.max(READER_FONT_SIZE_MIN_PERCENT, numericValue)
	);
}

function normalizeSettings(value: unknown): ReaderThemeSettings {
	const storedSettings = value && typeof value === 'object' ? value : {};
	const colorTheme = isReaderColorThemeId(
		(storedSettings as Partial<ReaderThemeSettings>).colorTheme
	)
		? (storedSettings as Partial<ReaderThemeSettings>).colorTheme!
		: DEFAULT_READER_SETTINGS.colorTheme;

	return {
		...DEFAULT_READER_SETTINGS,
		...(storedSettings as Partial<ReaderThemeSettings>),
		...getReaderColorThemeSettings(colorTheme),
		fontSizePercent: clampFontSizePercent(
			(storedSettings as Partial<ReaderThemeSettings>).fontSizePercent
		),
	};
}

function saveSettings(nextSettings: ReaderThemeSettings): void {
	try {
		getPreferenceManager().set(READER_SETTINGS_PREFERENCE_KEY, nextSettings);
	} catch {
		// Reader settings can be changed before app services finish booting in tests or previews.
	}
}

async function loadSettings(): Promise<void> {
	try {
		const preferenceManager = getPreferenceManager();
		await preferenceManager.waitForInit();
		settings = normalizeSettings(preferenceManager.get(READER_SETTINGS_PREFERENCE_KEY));
	} catch {
		settings = { ...DEFAULT_READER_SETTINGS };
	}
}

function updateSettings(patch: Partial<ReaderThemeSettings>): void {
	settings = {
		...settings,
		...patch,
	};
	saveSettings(settings);
}

function resetSettings(): void {
	settings = { ...DEFAULT_READER_SETTINGS };
	saveSettings(settings);
}

function applyColorTheme(colorTheme: ReaderColorThemeId): void {
	updateSettings(getReaderColorThemeSettings(colorTheme));
}

function setFontSizePercent(fontSizePercent: number): void {
	updateSettings({
		fontSizePercent: clampFontSizePercent(fontSizePercent),
	});
}

function increaseFontSize(): void {
	setFontSizePercent(settings.fontSizePercent + READER_FONT_SIZE_STEP_PERCENT);
}

function decreaseFontSize(): void {
	setFontSizePercent(settings.fontSizePercent - READER_FONT_SIZE_STEP_PERCENT);
}

export const readerSettingsStore = {
	get settings(): ReaderThemeSettings {
		return settings;
	},
	loadSettings,
	updateSettings,
	resetSettings,
	applyColorTheme,
	setFontSizePercent,
	increaseFontSize,
	decreaseFontSize,
};
