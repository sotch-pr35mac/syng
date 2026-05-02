import { open } from '@tauri-apps/plugin-dialog';
import { readFile, readTextFile } from '@tauri-apps/plugin-fs';
import type { ReaderImportPayload } from '@/types/reader.js';
import { describeUnknownError } from '@/utils/error.js';
import { createPlainTextReaderImportPayload } from '@/utils/readerPlainTextImport.js';
import {
	canUseNativeReaderPrepareImport,
	invokePrepareReaderImport,
} from '@/utils/readerNativeImport.js';
import { buildCanonicalImportFromPublication } from '@/utils/readerPublicationToCanonical.js';

const PDF_MIME_TYPE = 'application/pdf';
const EPUB_MIME_TYPE = 'application/epub+zip';
const TEXT_MIME_TYPE = 'text/plain';
const HTML_MIME_TYPE = 'text/html';
const DOCUMENT_EXTENSIONS = ['txt', 'text', 'epub', 'pdf', 'html', 'htm'];
/** Avoid huge IPC payloads if path-based native import fails but bytes-based retry is attempted. */
const MAX_NATIVE_BASE64_IMPORT_BYTES = 25 * 1024 * 1024;

function getFileName(path: string): string {
	return path.split(/[\\/]/).filter(Boolean).at(-1) ?? 'Untitled';
}

function getExtension(fileName: string): string {
	return fileName.split('.').at(-1)?.toLowerCase() ?? '';
}

function getTitleFromFileName(fileName: string): string {
	const extension = getExtension(fileName);
	return extension ? fileName.slice(0, -(extension.length + 1)) : fileName;
}

function getMimeType(extension: string): string {
	if (extension === 'pdf') {
		return PDF_MIME_TYPE;
	}
	if (extension === 'epub') {
		return EPUB_MIME_TYPE;
	}
	if (extension === 'html' || extension === 'htm') {
		return HTML_MIME_TYPE;
	}
	return TEXT_MIME_TYPE;
}

function getSourceType(extension: string): string {
	if (extension === 'pdf' || extension === 'epub') {
		return extension;
	}
	if (extension === 'html' || extension === 'htm') {
		return 'html';
	}
	return 'plain_text';
}

function asUint8Array(data: Uint8Array | number[]): Uint8Array {
	return data instanceof Uint8Array ? data : Uint8Array.from(data);
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
	let binary = '';
	const chunkSize = 0x8000;
	for (let start = 0; start < bytes.length; start += chunkSize) {
		const end = Math.min(start + chunkSize, bytes.length);
		const slice = bytes.subarray(start, end);
		binary += String.fromCharCode.apply(null, slice as unknown as number[]);
	}
	return btoa(binary);
}

export async function pickReaderImportFile(): Promise<ReaderImportPayload | undefined> {
	const selectedPath = await open({
		multiple: false,
		title: 'Import Reading Document',
		filters: [
			{
				name: 'Reader Documents',
				extensions: DOCUMENT_EXTENSIONS,
			},
		],
	});

	if (!selectedPath || Array.isArray(selectedPath)) {
		return undefined;
	}

	const fileName = getFileName(selectedPath);
	const extension = getExtension(fileName);
	const fallbackTitle = getTitleFromFileName(fileName) || 'Untitled';

	if (extension === 'txt' || extension === 'text') {
		const text = await readTextFile(selectedPath);
		return createPlainTextReaderImportPayload(fallbackTitle, text, {
			fileName,
			mimeType: TEXT_MIME_TYPE,
		});
	}

	if (extension === 'epub' || extension === 'html' || extension === 'htm') {
		const data = asUint8Array(await readFile(selectedPath));
		return buildCanonicalImportFromPublication({
			fileName,
			mimeType: getMimeType(extension),
			sourceType: getSourceType(extension),
			data,
			fallbackTitle,
		});
	}

	const mimeType = getMimeType(extension);
	const sourceType = getSourceType(extension);

	const data = asUint8Array(await readFile(selectedPath));

	if (extension === 'pdf' && canUseNativeReaderPrepareImport()) {
		try {
			const payload = await invokePrepareReaderImport({
				path: selectedPath,
				fileName,
				mimeType,
			});
			return {
				...payload,
				source_data: data,
			};
		} catch (pathImportError) {
			const pathDetails = describeUnknownError(pathImportError);
			console.error(
				'[reader.import] Native prepare_reader_import (path) failed.',
				pathImportError,
				Object.keys(pathDetails).length > 0 ? pathDetails : undefined
			);
			if (data.byteLength <= MAX_NATIVE_BASE64_IMPORT_BYTES) {
				try {
					const payload = await invokePrepareReaderImport({
						sourceBase64: uint8ArrayToBase64(data),
						fileName,
						mimeType,
					});
					return {
						...payload,
						source_data: data,
					};
				} catch (bytesImportError) {
					const bytesDetails = describeUnknownError(bytesImportError);
					console.error(
						'[reader.import] Native prepare_reader_import (sourceBase64) failed; falling back to pdf.js.',
						bytesImportError,
						Object.keys(bytesDetails).length > 0 ? bytesDetails : undefined
					);
				}
			} else {
				console.error(
					'[reader.import] PDF is too large for native base64 retry; falling back to pdf.js.',
					{ byteLength: data.byteLength }
				);
			}
		}
	}

	return buildCanonicalImportFromPublication({
		fileName,
		mimeType,
		sourceType,
		data,
		fallbackTitle,
	});
}
