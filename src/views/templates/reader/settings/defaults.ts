import type { ReaderThemeSettings } from '@/reader/types.js';

export const DEFAULT_READER_SETTINGS: ReaderThemeSettings = {
	view: 'paged',
	fontFamily: 'var(--sy-font-family)',
	fontSizePercent: 100,
	lineHeight: 1.8,
	marginScale: 1,
	columnCount: 1,
	backgroundColor: '#ffffff',
	textColor: '#171717',
	linkColor: '#1f6feb',
	selectionBackgroundColor: '#dbeafe',
	selectionTextColor: '#111827',
	writingMode: 'horizontal-tb',
	pdfZoom: 1,
	reducedMotion: false,
};
