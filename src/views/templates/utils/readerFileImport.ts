import { open } from '@tauri-apps/plugin-dialog';
import { readFile, readTextFile } from '@tauri-apps/plugin-fs';
import { openReaderPublication } from '@/reader/publication/index.js';
import { createPlainTextReaderImportPayload } from '@/utils/readerPlainTextImport.js';
import type { ReaderImportPayload } from '@/types/reader.js';

const PDF_MIME_TYPE = 'application/pdf';
const EPUB_MIME_TYPE = 'application/epub+zip';
const TEXT_MIME_TYPE = 'text/plain';
const DOCUMENT_EXTENSIONS = ['txt', 'text', 'epub', 'pdf'];

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
	return TEXT_MIME_TYPE;
}

function getSourceType(extension: string): string {
	if (extension === 'pdf' || extension === 'epub') {
		return extension;
	}
	return 'plain_text';
}

function asUint8Array(data: Uint8Array | number[]): Uint8Array {
	return data instanceof Uint8Array ? data : Uint8Array.from(data);
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

	const data = asUint8Array(await readFile(selectedPath));
	const mimeType = getMimeType(extension);
	const publication = await openReaderPublication({
		id: `preview:${fileName}`,
		fileName,
		mimeType,
		data,
	});

	return {
		title: publication.metadata.title || fallbackTitle,
		file_name: fileName,
		source_type: getSourceType(extension),
		mime_type: mimeType,
		extractor_version: publication.source.extractorVersion,
		text: '',
		blocks: [],
		source_data: data,
	};
}
