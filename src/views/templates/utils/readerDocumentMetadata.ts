import type { ReaderImportPayload, ReaderSchemaVersion } from '@/types/reader.js';

export const READER_DOCUMENT_TITLE_MAX_LENGTH = 30;
export const DEFAULT_READER_DOCUMENT_COLOR = '#ffffff';

// Sourced from theme.css color variables. Display is handled by CSS color-mix()
// in ReaderColorSwatches and ReaderLibrary, so these hex values are only used
// for storage and comparison. Keep in sync with theme.css if theme colors change.
export const READER_DOCUMENT_COLORS = [
	'#ffffff', // white
	'#76aff9', // --sy-color--blue-1
	'#43b866', // --sy-color--green-3
	'#e48e1c', // --sy-color--yellow-1
	'#e43978', // --sy-color--red-1
	'#8b6ed6', // lavender (no theme variable)
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
	const normalizedTitle = (title.trim() || importPayload.title || 'Untitled').slice(
		0,
		READER_DOCUMENT_TITLE_MAX_LENGTH
	);
	return {
		...importPayload,
		canonical_schema_version:
			importPayload.canonical_schema_version ?? (1 as ReaderSchemaVersion),
		title: normalizedTitle,
		color: normalizeReaderDocumentColor(color),
	};
}
