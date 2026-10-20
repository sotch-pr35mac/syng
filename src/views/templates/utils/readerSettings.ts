import type { ReaderColorThemeId, ReaderThemeSettings } from '@/types/reader.js';

export interface ReaderColorTheme {
	id: ReaderColorThemeId;
	label: string;
	backgroundColor: string;
	textColor: string;
	linkColor: string;
	selectionBackgroundColor: string;
	selectionTextColor: string;
	stageBackgroundColor: string;
	mutedTextColor: string;
	borderColor: string;
	controlBackgroundColor: string;
	controlTextColor: string;
}

export const READER_FONT_SIZE_MIN_PERCENT = 50;
export const READER_FONT_SIZE_MAX_PERCENT = 150;
export const READER_FONT_SIZE_STEP_PERCENT = 10;

const LIGHT_READER_COLOR_THEME: ReaderColorTheme = {
	id: 'light',
	label: 'Light',
	backgroundColor: '#ffffff',
	textColor: '#171717',
	linkColor: '#1f6feb',
	selectionBackgroundColor: '#dbeafe',
	selectionTextColor: '#111827',
	stageBackgroundColor: '#f5f5f5',
	mutedTextColor: '#6b7280',
	borderColor: '#e5e7eb',
	controlBackgroundColor: 'rgb(255 255 255 / 84%)',
	controlTextColor: '#474c5a',
};

const SEPIA_READER_COLOR_THEME: ReaderColorTheme = {
	id: 'sepia',
	label: 'Sepia',
	backgroundColor: '#f4ecd8',
	textColor: '#4a3322',
	linkColor: '#8a4f1d',
	selectionBackgroundColor: '#d7b884',
	selectionTextColor: '#24170e',
	stageBackgroundColor: '#d8c4a1',
	mutedTextColor: '#76593d',
	borderColor: '#d6c19e',
	controlBackgroundColor: 'rgb(244 236 216 / 88%)',
	controlTextColor: '#4a3322',
};

const DARK_READER_COLOR_THEME: ReaderColorTheme = {
	id: 'dark',
	label: 'Dark',
	backgroundColor: '#111111',
	textColor: '#f5f5f5',
	linkColor: '#8ab4ff',
	selectionBackgroundColor: '#374151',
	selectionTextColor: '#ffffff',
	stageBackgroundColor: '#050505',
	mutedTextColor: '#b6b6b6',
	borderColor: '#333333',
	controlBackgroundColor: 'rgb(17 17 17 / 86%)',
	controlTextColor: '#f5f5f5',
};

const AUTOMATIC_READER_COLOR_THEME: ReaderColorTheme = {
	...LIGHT_READER_COLOR_THEME,
	id: 'automatic',
	label: 'Automatic',
};

export const READER_COLOR_THEMES: ReaderColorTheme[] = [
	AUTOMATIC_READER_COLOR_THEME,
	LIGHT_READER_COLOR_THEME,
	SEPIA_READER_COLOR_THEME,
	DARK_READER_COLOR_THEME,
];

export const DEFAULT_READER_COLOR_THEME = AUTOMATIC_READER_COLOR_THEME;

const CONTRAST_READER_COLOR_THEMES: Record<
	Exclude<ReaderColorThemeId, 'automatic'>,
	ReaderColorTheme
> = {
	light: { ...LIGHT_READER_COLOR_THEME, mutedTextColor: '#667080' },
	sepia: { ...SEPIA_READER_COLOR_THEME, mutedTextColor: '#664a31' },
	dark: DARK_READER_COLOR_THEME,
};

/** Resolve the page theme independently of the optional Increase Contrast treatment. */
export function getReaderColorTheme(
	id: ReaderColorThemeId,
	prefersDark = false,
	increaseContrast = false
): ReaderColorTheme {
	const resolvedId = id === 'automatic' ? (prefersDark ? 'dark' : 'light') : id;
	const theme =
		READER_COLOR_THEMES.find((theme) => theme.id === resolvedId) ?? LIGHT_READER_COLOR_THEME;
	return increaseContrast ? (CONTRAST_READER_COLOR_THEMES[resolvedId] ?? theme) : theme;
}

export function getReaderColorThemeSettings(
	id: ReaderColorThemeId,
	prefersDark = false
): Pick<
	ReaderThemeSettings,
	| 'colorTheme'
	| 'backgroundColor'
	| 'textColor'
	| 'linkColor'
	| 'selectionBackgroundColor'
	| 'selectionTextColor'
> {
	const theme = getReaderColorTheme(id, prefersDark);
	return {
		colorTheme: id,
		backgroundColor: theme.backgroundColor,
		textColor: theme.textColor,
		linkColor: theme.linkColor,
		selectionBackgroundColor: theme.selectionBackgroundColor,
		selectionTextColor: theme.selectionTextColor,
	};
}

export const DEFAULT_READER_SETTINGS: ReaderThemeSettings = {
	view: 'paged',
	...getReaderColorThemeSettings(DEFAULT_READER_COLOR_THEME.id),
	fontFamily: 'var(--sy-font-family)',
	fontSizePercent: 100,
	lineHeight: 2,
	marginScale: 1,
	columnCount: 1,
	writingMode: 'horizontal-tb',
	pdfZoom: 1,
	reducedMotion: false,
};
