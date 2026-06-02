import { invoke } from '@tauri-apps/api/core';
import { afterEach, expect, it, vi } from 'vitest';
import {
	canUseNativeReaderPrepareImport,
	createPlainTextReaderImportPayload,
	ensureReaderDocumentForRendering,
	inferPlainTextReaderTitle,
	invokePrepareReaderImport,
	LARGE_HTML_IMPORT_ERROR_CODE,
	parseLargeHtmlImportError,
} from '@/utils/readerDocument.js';
import type { ReaderDocument, ReaderExtractorVersion } from '@/types/reader.js';
import { NATIVE_COMMANDS } from '@/types/nativeCommands.js';

vi.mock('@tauri-apps/api/core', () => ({
	invoke: vi.fn(),
}));

afterEach(() => {
	Reflect.deleteProperty(window, '__TAURI_INTERNALS__');
	vi.mocked(invoke).mockReset();
});

function buildDocument(): ReaderDocument {
	return {
		_id: 'reader-legacy',
		title: 'Legacy',
		file_name: 'legacy.txt',
		source_type: 'plain_text',
		mime_type: 'text/plain',
		extractor_version: 1 as ReaderExtractorVersion,
		text: 'This text used to be upgraded into blocks.',
		blocks: [],
		imported_at: '2026-01-01T00:00:00.000Z',
		updated_at: '2026-01-01T00:00:00.000Z',
		reading_order: [{ href: 'text', type: 'text/plain', title: 'Legacy' }],
		progress: {
			resource_href: 'text',
			position: 0,
			total_progression: 0,
			page_index: 0,
			text_position: { start: 0, end: 0 },
			text_quote: { exact: '', prefix: '', suffix: '' },
			updated_at: '2026-01-01T00:00:00.000Z',
		},
	};
}

it('does not upgrade legacy text-only documents into blocks', () => {
	const document = ensureReaderDocumentForRendering(buildDocument());

	expect(document.canonical_schema_version).toBe(1);
	expect(document.blocks).toEqual([]);
});

it('reports native prepare import unavailable when Tauri internals are not present', () => {
	Reflect.deleteProperty(window, '__TAURI_INTERNALS__');
	expect(canUseNativeReaderPrepareImport()).toBe(false);
});

it('wraps prepare reader import args for the native command contract', async () => {
	const payload = {
		title: 'Clipboard',
		file_name: 'clipboard.txt',
		source_type: 'plain_text',
		mime_type: 'text/plain',
		extractor_version: 1,
		text: '你好',
		blocks: [],
	};
	vi.mocked(invoke).mockResolvedValue(payload);

	await expect(
		invokePrepareReaderImport({
			text: '你好',
			title: 'Clipboard',
			fileName: 'clipboard.txt',
			allowLargeHtml: true,
		})
	).resolves.toBe(payload);

	expect(invoke).toHaveBeenCalledWith(NATIVE_COMMANDS.READER.PREPARE_IMPORT, {
		args: {
			text: '你好',
			title: 'Clipboard',
			fileName: 'clipboard.txt',
			allowLargeHtml: true,
		},
	});
});

it('parses native large HTML confirmation errors', () => {
	const error = JSON.stringify({
		code: LARGE_HTML_IMPORT_ERROR_CODE,
		message: 'Large webpage',
		receivedBytes: 12,
		warningBytes: 10,
		maxBytes: 100,
	});

	expect(parseLargeHtmlImportError(error)).toEqual({
		code: LARGE_HTML_IMPORT_ERROR_CODE,
		message: 'Large webpage',
		receivedBytes: 12,
		warningBytes: 10,
		maxBytes: 100,
	});
});

it('creates a plain text reader import payload from pasted text', () => {
	const payload = createPlainTextReaderImportPayload(
		' Sample / Story ',
		'Title\r\n\r\n你好今天的天气还好。\r\nSecond line.'
	);

	expect(payload).toMatchObject({
		title: 'Sample / Story',
		file_name: 'Sample - Story.txt',
		source_type: 'plain_text',
		mime_type: 'text/plain',
		extractor_version: 1,
		color: '#ffffff',
		text: 'Title\n\n你好今天的天气还好。\nSecond line.',
	});
	expect(payload.blocks).toHaveLength(2);
	expect(payload.blocks[0]).toMatchObject({
		kind: 'paragraph',
		text: 'Title',
		start_offset: 0,
		end_offset: 6,
		participates_in_linear_text: true,
	});
	expect(payload.blocks[1]).toMatchObject({
		kind: 'paragraph',
		text: '你好今天的天气还好。\nSecond line.',
		start_offset: 7,
		end_offset: 30,
		participates_in_linear_text: true,
	});
	expect(payload.blocks[0].id).toMatch(/^[0-9a-f-]{36}$/i);
	expect(payload.blocks[1].id).toMatch(/^[0-9a-f-]{36}$/i);
});

it('keeps closing punctuation from making quoted sentences look like headings', () => {
	const payload = createPlainTextReaderImportPayload(
		'Quoted',
		'他笑着说：“这条巷子里的人平时看起来都很忙，但不代表他们没有心。”'
	);

	expect(payload.blocks).toHaveLength(1);
	expect(payload.blocks[0].kind).toBe('paragraph');
});

it('infers a title and preserves import options', () => {
	const title = inferPlainTextReaderTitle('\n Imported Heading \n\nBody');
	const payload = createPlainTextReaderImportPayload(title, 'Imported Heading\n\nBody', {
		color: '#91d7b4',
		fileName: 'webpage.txt',
		sourceType: 'webpage',
		sourceUrl: 'https://example.com/article',
	});

	expect(title).toBe('Imported Heading');
	expect(payload).toMatchObject({
		title: 'Imported Heading',
		file_name: 'webpage.txt',
		source_type: 'webpage',
		color: '#91d7b4',
		source_url: 'https://example.com/article',
	});
});
