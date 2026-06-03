import {
	DEFAULT_READER_SETTINGS,
	getReaderColorThemeSettings,
	READER_COLOR_THEMES,
	READER_FONT_SIZE_MAX_PERCENT,
	READER_FONT_SIZE_MIN_PERCENT,
	READER_FONT_SIZE_STEP_PERCENT,
} from '@/utils/readerSettings.js';
import type { ReaderColorThemeId, ReaderThemeSettings } from '@/types/reader.js';
import { getPreferenceManager } from '@/utils/appServices.js';

const READER_SETTINGS_PREFERENCE_KEY = 'readerSettings';
const READER_LINE_HEIGHT_MIN = 1;
const READER_LINE_HEIGHT_MAX = 3;
const READER_MARGIN_SCALE_MIN = 0.5;
const READER_MARGIN_SCALE_MAX = 2;
const READER_COLUMN_COUNT_MIN = 1;
const READER_COLUMN_COUNT_MAX = 3;
const READER_PDF_ZOOM_MIN = 0.5;
const READER_PDF_ZOOM_MAX = 4;

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

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
	const numericValue = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
	return Math.min(max, Math.max(min, numericValue));
}

function normalizeSettings(value: unknown): ReaderThemeSettings {
	const storedSettings = (
		value && typeof value === 'object' ? value : {}
	) as Partial<ReaderThemeSettings>;
	const colorTheme = isReaderColorThemeId(storedSettings.colorTheme)
		? storedSettings.colorTheme!
		: DEFAULT_READER_SETTINGS.colorTheme;

	// Persisted numeric settings are validated/clamped (not just spread) so a corrupt or
	// downgraded settings blob can't feed an invalid value (e.g. lineHeight: 0) straight to CSS.
	return {
		...DEFAULT_READER_SETTINGS,
		...storedSettings,
		...getReaderColorThemeSettings(colorTheme),
		fontSizePercent: clampFontSizePercent(storedSettings.fontSizePercent),
		lineHeight: clampNumber(
			storedSettings.lineHeight,
			DEFAULT_READER_SETTINGS.lineHeight,
			READER_LINE_HEIGHT_MIN,
			READER_LINE_HEIGHT_MAX
		),
		marginScale: clampNumber(
			storedSettings.marginScale,
			DEFAULT_READER_SETTINGS.marginScale,
			READER_MARGIN_SCALE_MIN,
			READER_MARGIN_SCALE_MAX
		),
		columnCount: Math.round(
			clampNumber(
				storedSettings.columnCount,
				DEFAULT_READER_SETTINGS.columnCount,
				READER_COLUMN_COUNT_MIN,
				READER_COLUMN_COUNT_MAX
			)
		),
		pdfZoom: clampNumber(
			storedSettings.pdfZoom,
			DEFAULT_READER_SETTINGS.pdfZoom,
			READER_PDF_ZOOM_MIN,
			READER_PDF_ZOOM_MAX
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
