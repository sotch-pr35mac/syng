import type { ReaderPublication, ReaderReadingOrderItem, ReaderResource } from '@/reader/types.js';
import { configurePdfJsWorker } from '@/reader/pdfjsWorker.js';
import {
	createDefaultCapabilities,
	createDefaultMetadata,
	createPublicationSource,
	type ReaderAdapterInput,
	type ReaderFormatAdapter,
} from '@/reader/publication/adapters.js';

function asArrayBuffer(data: ArrayBuffer | Uint8Array): ArrayBuffer {
	if (data instanceof ArrayBuffer) {
		return data.slice(0);
	}
	const copy = new Uint8Array(data.byteLength);
	copy.set(data);
	return copy.buffer;
}

export const pdfPublicationAdapter: ReaderFormatAdapter = {
	format: 'pdf',
	canOpen(input: ReaderAdapterInput): boolean {
		return (
			Boolean(input.data) &&
			(input.mimeType === 'application/pdf' || input.fileName?.endsWith('.pdf'))
		);
	},
	async open(input: ReaderAdapterInput): Promise<ReaderPublication> {
		if (!input.data) {
			throw new Error('PDF data is required.');
		}

		const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist');
		configurePdfJsWorker(GlobalWorkerOptions);
		const pdf = await getDocument({ data: asArrayBuffer(input.data) }).promise;
		const metadata = await pdf.getMetadata().catch(() => undefined);
		const infoTitle =
			metadata && 'info' in metadata && metadata.info && 'Title' in metadata.info
				? String(metadata.info.Title)
				: undefined;

		const readingOrder: ReaderReadingOrderItem[] = [];
		const resources: ReaderResource[] = [];
		for (let pageIndex = 0; pageIndex < pdf.numPages; pageIndex += 1) {
			const href = `pdf/page-${pageIndex + 1}`;
			readingOrder.push({
				href,
				type: 'application/pdf',
				title: `Page ${pageIndex + 1}`,
			});
			resources.push({
				href,
				type: 'application/pdf',
				kind: 'fixed-page',
				data: asArrayBuffer(input.data),
				pageIndex,
			});
		}

		return {
			id: input.id,
			format: 'pdf',
			metadata: {
				...createDefaultMetadata(input),
				title: input.title ?? infoTitle ?? input.fileName ?? 'PDF',
			},
			source: createPublicationSource(input, 'pdf'),
			readingOrder,
			resources,
			capabilities: createDefaultCapabilities({
				fixedLayout: true,
				hasTextLayer: true,
				supportsDictionaryLookup: true,
			}),
		};
	},
};
