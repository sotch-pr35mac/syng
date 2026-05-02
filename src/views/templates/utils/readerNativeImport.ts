import { invoke } from '@tauri-apps/api/core';
import type { ReaderImportPayload } from '@/types/reader.js';
import { NATIVE_COMMANDS } from '@/types/nativeCommands.js';

export type PrepareReaderImportInvokeArgs = {
	/** Absolute path to the file; avoids huge base64 payloads over IPC. */
	path?: string;
	sourceBase64?: string;
	fileName?: string;
	mimeType?: string;
	html?: string;
	title?: string;
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
	return await invoke<ReaderImportPayload>(NATIVE_COMMANDS.READER.PREPARE_IMPORT, args);
}
