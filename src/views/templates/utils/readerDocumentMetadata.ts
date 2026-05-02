import type { ReaderImportPayload } from '@/types/reader.js';

export const DEFAULT_READER_DOCUMENT_COLOR = '#ffffff';

export const READER_DOCUMENT_COLORS = [
	'#ffffff',
	'#f5d36c',
	'#91d7b4',
	'#8fc7f4',
	'#c9b6f2',
	'#f2a6a6',
	'#f2b36f',
	'#b7c0cc',
];

const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

export function normalizeReaderDocumentColor(color: string | undefined): string {
	const normalizedColor = color?.trim();
	return normalizedColor && HEX_COLOR_PATTERN.test(normalizedColor)
		? normalizedColor.toLowerCase()
		: DEFAULT_READER_DOCUMENT_COLOR;
}

export function applyReaderImportMetadata(
	importPayload: ReaderImportPayload,
	title: string,
	color: string
): ReaderImportPayload {
	const normalizedTitle = title.trim() || importPayload.title || 'Untitled';
	return {
		...importPayload,
		title: normalizedTitle,
		color: normalizeReaderDocumentColor(color),
	};
}
