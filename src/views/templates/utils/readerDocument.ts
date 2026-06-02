import { invoke } from '@tauri-apps/api/core';
import type {
	ReaderContentBlock,
	ReaderDocument,
	ReaderExtractorVersion,
	ReaderImportPayload,
	ReaderSchemaVersion,
	ReaderTableExtension,
} from '@/types/reader.js';
import { NATIVE_COMMANDS } from '@/types/nativeCommands.js';

// --- Supported-format labels (import UI) ---

export const READER_SUPPORTED_DOCUMENT_FORMAT_LABEL = 'TXT, EPUB, PDF, DOCX, RTF';

export const READER_SUPPORTED_TEXT_ENCODING_LABEL = 'UTF-8, UTF-16, GBK/GB18030/GB2312, Big5';

// --- Canonical document normalization ---

export const CURRENT_CANONICAL_SCHEMA_VERSION = 1 as ReaderSchemaVersion;

function participatesInLinearText(block: ReaderContentBlock): boolean {
	return block.participates_in_linear_text !== false;
}

/**
 * Ensures a document has canonical blocks for the single reader pipeline.
 * First-version reader documents are expected to already contain canonical blocks.
 */
export function ensureReaderDocumentForRendering(document: ReaderDocument): ReaderDocument {
	const canonicalVersion = document.canonical_schema_version ?? CURRENT_CANONICAL_SCHEMA_VERSION;

	return {
		...document,
		canonical_schema_version: canonicalVersion,
	};
}

export function isTableBlock(block: ReaderContentBlock): boolean {
	return (
		block.kind === 'table' &&
		Boolean(block.extensions?.table) &&
		!participatesInLinearText(block)
	);
}

export function getTableExtension(block: ReaderContentBlock): ReaderTableExtension | undefined {
	return block.extensions?.table;
}

export function tableCellTokenKey(blockId: string, row: number, col: number): string {
	return `${blockId}::${row}::${col}`;
}

// --- Document metadata (title, color) ---

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

// --- Native import bridge & plain-text import ---

export type PrepareReaderImportInvokeArgs = {
	sourceBase64?: string;
	fileName?: string;
	mimeType?: string;
	html?: string;
	text?: string;
	title?: string;
	url?: string;
	allowLargeHtml?: boolean;
};

export const LARGE_HTML_IMPORT_ERROR_CODE = 'reader_large_html_requires_confirmation';
export const LARGE_HTML_IMPORT_CANCELED_MESSAGE = 'Webpage import canceled.';

export type LargeHtmlImportError = {
	code: typeof LARGE_HTML_IMPORT_ERROR_CODE;
	message: string;
	receivedBytes: number;
	warningBytes: number;
	maxBytes: number;
};

function isTauriRuntime(): boolean {
	return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export function canUseNativeReaderPrepareImport(): boolean {
	return isTauriRuntime();
}

export async function invokePrepareReaderImport(
	args: PrepareReaderImportInvokeArgs
): Promise<ReaderImportPayload> {
	return await invoke<ReaderImportPayload>(NATIVE_COMMANDS.READER.PREPARE_IMPORT, { args });
}

export function parseLargeHtmlImportError(error: unknown): LargeHtmlImportError | undefined {
	const raw = typeof error === 'string' ? error : error instanceof Error ? error.message : '';
	if (!raw) {
		return undefined;
	}
	try {
		const parsed = JSON.parse(raw) as Partial<LargeHtmlImportError>;
		if (parsed.code === LARGE_HTML_IMPORT_ERROR_CODE) {
			return {
				code: LARGE_HTML_IMPORT_ERROR_CODE,
				message: parsed.message ?? 'This webpage is unusually large.',
				receivedBytes: Number(parsed.receivedBytes ?? 0),
				warningBytes: Number(parsed.warningBytes ?? 0),
				maxBytes: Number(parsed.maxBytes ?? 0),
			};
		}
	} catch {
		return undefined;
	}
	return undefined;
}

/** Opens the native picker and returns the canonical Rust reader import payload. */
export async function invokeImportReaderDocument(): Promise<ReaderImportPayload | undefined> {
	return await invoke<ReaderImportPayload | undefined>(NATIVE_COMMANDS.READER.IMPORT_DOCUMENT);
}

const TEXT_EXTRACTOR_VERSION = 1 as ReaderExtractorVersion;
const FILE_NAME_STEM_LIMIT = 80;
const RANDOM_ID_RADIX = 36;
const RANDOM_ID_SLICE_END = 11;

function normalizeLineEndings(text: string): string {
	return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function createBlockId(): string {
	if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
		return crypto.randomUUID();
	}
	return `block-${Date.now()}-${Math.random().toString(RANDOM_ID_RADIX).slice(2, RANDOM_ID_SLICE_END)}`;
}

function pushTextBlock(
	blocks: ReaderContentBlock[],
	startOffset: number,
	endOffset: number,
	lines: string[]
): void {
	const text = lines.join('\n');
	blocks.push({
		id: createBlockId(),
		kind: 'paragraph',
		text,
		start_offset: startOffset,
		end_offset: endOffset,
		participates_in_linear_text: true,
	});
}

/** Build canonical paragraph/heading blocks from normalized plain text (UTF-16 offsets). */
export function extractReaderBlocksFromPlainText(text: string): ReaderContentBlock[] {
	const blocks: ReaderContentBlock[] = [];
	let blockStart: number | undefined;
	let blockLines: string[] = [];
	let cursor = 0;

	for (const match of text.matchAll(/[^\n]*(?:\n|$)/g)) {
		const line = match[0];
		if (line === '') {
			continue;
		}
		const lineWithoutBreak = line.endsWith('\n') ? line.slice(0, -1) : line;
		const lineStart = cursor;
		const lineEnd = cursor + line.length;

		if (lineWithoutBreak.trim().length === 0) {
			if (blockStart !== undefined) {
				pushTextBlock(blocks, blockStart, lineStart, blockLines);
				blockStart = undefined;
				blockLines = [];
			}
		} else {
			blockStart ??= lineStart;
			blockLines.push(lineWithoutBreak);
		}

		cursor = lineEnd;
	}

	if (blockStart !== undefined) {
		pushTextBlock(blocks, blockStart, text.length, blockLines);
	}

	if (!blocks.length && text.trim().length === 0) {
		blocks.push({
			id: createBlockId(),
			kind: 'paragraph',
			text: '',
			start_offset: 0,
			end_offset: text.length,
			participates_in_linear_text: true,
		});
	}

	return blocks;
}

function createClipboardFileName(title: string): string {
	const stem = title
		.trim()
		.replace(/[\\/:*?"<>|]/g, '-')
		.replace(/\s+/g, ' ')
		.slice(0, FILE_NAME_STEM_LIMIT);
	return `${stem || 'Untitled'}.txt`;
}

export function inferPlainTextReaderTitle(rawText: string): string {
	const text = normalizeLineEndings(rawText);
	const firstLine = text
		.split('\n')
		.map((line) => line.trim())
		.find(Boolean);
	return firstLine?.slice(0, FILE_NAME_STEM_LIMIT) ?? '';
}

export function createPlainTextReaderImportPayload(
	title: string,
	rawText: string,
	options: {
		color?: string;
		fileName?: string;
		mimeType?: string;
		sourceType?: string;
		sourceUrl?: string;
	} = {}
): ReaderImportPayload {
	const normalizedTitle = title.trim() || 'Untitled';
	const text = normalizeLineEndings(rawText);
	return {
		canonical_schema_version: 1 as ReaderSchemaVersion,
		title: normalizedTitle,
		file_name: options.fileName ?? createClipboardFileName(normalizedTitle),
		source_type: options.sourceType ?? 'plain_text',
		mime_type: options.mimeType ?? 'text/plain',
		extractor_version: TEXT_EXTRACTOR_VERSION,
		text,
		blocks: extractReaderBlocksFromPlainText(text),
		color: normalizeReaderDocumentColor(options.color),
		source_url: options.sourceUrl,
	};
}
