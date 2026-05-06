import { invoke } from '@tauri-apps/api/core';
import type { ReaderImportPayload } from '@/types/reader.js';
import { NATIVE_COMMANDS } from '@/types/nativeCommands.js';

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
