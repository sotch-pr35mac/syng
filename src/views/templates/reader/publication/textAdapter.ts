import type { ReaderPublication } from '@/reader/types.js';
import {
	createDefaultCapabilities,
	createDefaultMetadata,
	createPublicationSource,
	normalizeText,
	type ReaderAdapterInput,
	type ReaderFormatAdapter,
} from '@/reader/publication/adapters.js';

const TEXT_RESOURCE_HREF = 'text/main.txt';

export const textPublicationAdapter: ReaderFormatAdapter = {
	format: 'text',
	canOpen(input: ReaderAdapterInput): boolean {
		return Boolean(input.text) || input.mimeType?.startsWith('text/plain') === true;
	},
	async open(input: ReaderAdapterInput): Promise<ReaderPublication> {
		const text = normalizeText(input.text ?? '');
		return {
			id: input.id,
			format: 'text',
			metadata: createDefaultMetadata(input),
			source: createPublicationSource(input, 'text'),
			readingOrder: [
				{
					href: TEXT_RESOURCE_HREF,
					type: 'text/plain',
					title: input.title ?? input.fileName,
				},
			],
			resources: [
				{
					href: TEXT_RESOURCE_HREF,
					type: 'text/plain',
					kind: 'reflowable-document',
					text,
				},
			],
			capabilities: createDefaultCapabilities({
				reflowable: true,
				hasTextLayer: true,
				supportsDictionaryLookup: true,
				supportsThemes: true,
			}),
		};
	},
};
