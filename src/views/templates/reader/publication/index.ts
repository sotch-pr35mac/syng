import type { ReaderPublication } from '@/reader/types.js';
import type { ReaderAdapterInput, ReaderFormatAdapter } from '@/reader/publication/adapters.js';
import { epubPublicationAdapter } from '@/reader/publication/epubAdapter.js';
import { pdfPublicationAdapter } from '@/reader/publication/pdfAdapter.js';
import { textPublicationAdapter } from '@/reader/publication/textAdapter.js';
import { webpagePublicationAdapter } from '@/reader/publication/webpageAdapter.js';

export { epubPublicationAdapter } from '@/reader/publication/epubAdapter.js';
export { pdfPublicationAdapter } from '@/reader/publication/pdfAdapter.js';
export { textPublicationAdapter } from '@/reader/publication/textAdapter.js';
export { webpagePublicationAdapter } from '@/reader/publication/webpageAdapter.js';
export type { ReaderAdapterInput, ReaderFormatAdapter } from '@/reader/publication/adapters.js';

export const readerFormatAdapters: ReaderFormatAdapter[] = [
	textPublicationAdapter,
	webpagePublicationAdapter,
	epubPublicationAdapter,
	pdfPublicationAdapter,
];

export async function openReaderPublication(
	input: ReaderAdapterInput,
	adapters = readerFormatAdapters
): Promise<ReaderPublication> {
	const adapter = adapters.find((candidate) => candidate.canOpen(input));
	if (!adapter) {
		throw new Error(
			`No reader adapter can open ${input.fileName ?? input.mimeType ?? input.id}.`
		);
	}
	return adapter.open(input);
}
