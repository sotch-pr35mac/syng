import type { ReaderImportPayload } from '@/types/reader.js';
import { invokeImportReaderDocument } from '@/utils/readerNativeImport.js';

/** Opens Rust's reader import dialog and returns the canonical native import payload. */
export async function pickReaderImportFile(): Promise<ReaderImportPayload | undefined> {
	return await invokeImportReaderDocument();
}
