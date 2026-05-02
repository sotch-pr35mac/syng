import { Readability } from '@mozilla/readability';
import type { ReaderPublication } from '@/reader/types.js';
import { sanitizeReflowableReaderHtml } from '@/utils/readerHtmlSanitize.js';
import {
	createDefaultCapabilities,
	createDefaultMetadata,
	createPublicationSource,
	type ReaderAdapterInput,
	type ReaderFormatAdapter,
} from '@/reader/publication/adapters.js';

const WEBPAGE_RESOURCE_HREF = 'webpage/article.html';

function extractReadableArticle(
	html: string,
	sourceUrl?: string
): { title?: string; content: string } {
	const document = new DOMParser().parseFromString(html, 'text/html');
	if (sourceUrl) {
		const baseElement = document.createElement('base');
		baseElement.href = sourceUrl;
		document.head.append(baseElement);
	}
	const article = new Readability(document).parse();

	return {
		title: article?.title,
		content: article?.content ?? document.body.innerHTML,
	};
}

export const webpagePublicationAdapter: ReaderFormatAdapter = {
	format: 'webpage',
	canOpen(input: ReaderAdapterInput): boolean {
		return Boolean(input.html) || input.mimeType === 'text/html';
	},
	async open(input: ReaderAdapterInput): Promise<ReaderPublication> {
		const article = extractReadableArticle(input.html ?? '', input.sourceUrl);
		const sanitizedHtml = sanitizeReflowableReaderHtml(article.content);

		return {
			id: input.id,
			format: 'webpage',
			metadata: {
				...createDefaultMetadata(input),
				title: input.title ?? article.title ?? input.fileName ?? 'Web Article',
				sourceUrl: input.sourceUrl,
			},
			source: createPublicationSource(input, 'webpage'),
			readingOrder: [
				{
					href: WEBPAGE_RESOURCE_HREF,
					type: 'text/html',
					title: input.title ?? article.title,
				},
			],
			resources: [
				{
					href: WEBPAGE_RESOURCE_HREF,
					type: 'text/html',
					kind: 'reflowable-document',
					html: sanitizedHtml,
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
