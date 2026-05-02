import { openReaderPublication } from '@/reader/publication/index.js';
import { configurePdfJsWorker, getPdfJsDocumentInitOptions } from '@/reader/pdfjsWorker.js';
import type { ReaderContentBlock, ReaderImportPayload } from '@/types/reader.js';
import { buildReaderDocumentFromHtmlParts } from '@/utils/readerHtmlToCanonical.js';
import { extractReaderBlocksFromPlainText } from '@/utils/readerPlainTextImport.js';

async function extractPdfPlainText(data: Uint8Array): Promise<string> {
	const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist');
	configurePdfJsWorker(GlobalWorkerOptions);
	const copy = new Uint8Array(data.byteLength);
	copy.set(data);
	const pdf = await getDocument({
		data: copy.buffer,
		...getPdfJsDocumentInitOptions(),
	}).promise;
	const parts: string[] = [];
	for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
		const page = await pdf.getPage(pageNumber);
		const textContent = await page.getTextContent();
		const items = Array.isArray(textContent?.items) ? textContent.items : [];
		const strings = items.map((item) =>
			'str' in item && typeof item.str === 'string' ? item.str : ''
		);
		parts.push(strings.join(' ').trim());
	}
	await pdf.destroy();
	return parts.filter(Boolean).join('\n\n');
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
	if (typeof crypto === 'undefined' || !crypto.subtle) {
		return '';
	}
	const hashInput = new Uint8Array(bytes.byteLength);
	hashInput.set(bytes);
	const digest = await crypto.subtle.digest('SHA-256', hashInput);
	return Array.from(new Uint8Array(digest))
		.map((byte) => byte.toString(16).padStart(2, '0'))
		.join('');
}

export async function buildCanonicalImportFromPublication(options: {
	fileName: string;
	mimeType: string;
	sourceType: string;
	data: Uint8Array;
	fallbackTitle: string;
}): Promise<ReaderImportPayload> {
	const publication = await openReaderPublication({
		id: `preview:${options.fileName}`,
		fileName: options.fileName,
		mimeType: options.mimeType,
		data: options.data,
	});

	const title = publication.metadata.title || options.fallbackTitle;
	const sourceSha256 = await sha256Hex(options.data);

	let text: string;
	let blocks: ReaderContentBlock[];

	if (publication.format === 'pdf') {
		const combinedPlain = await extractPdfPlainText(options.data);
		text = combinedPlain.trim() || title;
		blocks = extractReaderBlocksFromPlainText(text);
	} else {
		const htmlParts: string[] = [];
		const textFallback: string[] = [];
		for (const item of publication.readingOrder) {
			const resource = publication.resources.find(
				(resourceItem) => resourceItem.href === item.href
			);
			if (resource?.html) {
				htmlParts.push(resource.html);
			} else {
				const plain = (resource?.text ?? '').trim();
				if (plain) {
					textFallback.push(plain);
				}
			}
		}

		if (htmlParts.length > 0) {
			const built = buildReaderDocumentFromHtmlParts(htmlParts);
			text = built.text.trim() || title;
			blocks = built.blocks.length > 0 ? built.blocks : extractReaderBlocksFromPlainText(text);
		} else {
			const combinedPlain = textFallback.filter(Boolean).join('\n\n');
			text = combinedPlain.trim() || title;
			blocks = extractReaderBlocksFromPlainText(text);
		}
	}

	return {
		canonical_schema_version: 1,
		title,
		file_name: options.fileName,
		source_type: options.sourceType,
		mime_type: options.mimeType,
		extractor_version: publication.source.extractorVersion,
		text,
		blocks,
		source_data: options.data,
		source_sha256: sourceSha256 || undefined,
		source_byte_length: options.data.byteLength,
	};
}
