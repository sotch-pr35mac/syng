import { invoke } from '@tauri-apps/api/core';
import { afterEach, expect, it, vi } from 'vitest';
import {
	canUseNativeReaderPrepareImport,
	invokePrepareReaderImport,
	LARGE_HTML_IMPORT_ERROR_CODE,
	parseLargeHtmlImportError,
} from '@/utils/readerNativeImport.js';
import { NATIVE_COMMANDS } from '@/types/nativeCommands.js';

vi.mock('@tauri-apps/api/core', () => ({
	invoke: vi.fn(),
}));

afterEach(() => {
	Reflect.deleteProperty(window, '__TAURI_INTERNALS__');
	vi.mocked(invoke).mockReset();
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
