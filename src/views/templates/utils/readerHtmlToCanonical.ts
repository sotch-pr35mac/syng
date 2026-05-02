import type {
	ReaderContentBlock,
	ReaderTableCell,
	ReaderTableExtension,
	ReaderTableRow,
} from '@/types/reader.js';

const SKIP_TAGS = new Set([
	'SCRIPT',
	'STYLE',
	'NOSCRIPT',
	'IFRAME',
	'SVG',
	'LINK',
	'META',
	'TEMPLATE',
]);

const CONTAINER_TAGS = new Set([
	'DIV',
	'SECTION',
	'ARTICLE',
	'MAIN',
	'HEADER',
	'FOOTER',
	'NAV',
	'ASIDE',
	'BODY',
	'HR',
	'BR',
	'SPAN',
	'STRONG',
	'EM',
	'B',
	'I',
	'U',
	'A',
	'CODE',
	'MARK',
	'SUP',
	'SUB',
	'SMALL',
	'FIGURE',
	'FIGCAPTION',
	'PICTURE',
	'SOURCE',
]);

function newBlockId(): string {
	if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
		return crypto.randomUUID();
	}
	return `block-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function normalizeWhitespace(text: string): string {
	return text.replace(/\s+/g, ' ').trim();
}

function extractTableExtension(table: HTMLTableElement): ReaderTableExtension {
	const rows: ReaderTableRow[] = [];
	for (const rowElement of table.querySelectorAll('tr')) {
		const cells: ReaderTableCell[] = [];
		for (const cell of rowElement.querySelectorAll('th, td')) {
			cells.push({ text: normalizeWhitespace(cell.textContent ?? '') });
		}
		if (cells.length > 0) {
			rows.push({ cells });
		}
	}
	return { rows };
}

function parseDimension(value: string | null): number | undefined {
	if (!value) {
		return undefined;
	}
	const parsed = Number.parseInt(value, 10);
	return Number.isFinite(parsed) ? parsed : undefined;
}

export type ReaderHtmlToCanonicalOptions = {
	/** Resolve relative <img src> / srcset against this URL (e.g. fetched webpage URL). */
	baseUrl?: string;
};

function pickFirstSrcsetUrl(srcset: string | null | undefined): string | undefined {
	if (!srcset) {
		return undefined;
	}
	const firstPart = srcset.split(',')[0]?.trim();
	if (!firstPart) {
		return undefined;
	}
	const urlPart = firstPart.split(/\s+/)[0]?.trim();
	return urlPart || undefined;
}

function pickBestRawImageSource(imageElement: HTMLImageElement): string {
	const lazyAttributeNames = [
		'src',
		'data-src',
		'data-lazy-src',
		'data-original',
		'data-orig-src',
		'data-lazyloaded',
	];
	for (const attributeName of lazyAttributeNames) {
		const value = imageElement.getAttribute(attributeName)?.trim();
		if (value) {
			return value;
		}
	}
	return pickFirstSrcsetUrl(imageElement.getAttribute('srcset')) ?? '';
}

function resolveImageSourceUrl(rawSource: string, baseUrl: string | undefined): string {
	const trimmed = rawSource.trim();
	if (!trimmed || /^data:/i.test(trimmed) || /^blob:/i.test(trimmed)) {
		return trimmed;
	}
	if (!baseUrl) {
		return trimmed;
	}
	try {
		return new URL(trimmed, baseUrl).href;
	} catch {
		return trimmed;
	}
}

function assignLinearOffsets(blocks: ReaderContentBlock[]): string {
	let documentText = '';
	for (const block of blocks) {
		if (block.participates_in_linear_text === false) {
			continue;
		}
		const prefix = documentText.length > 0 ? '\n' : '';
		const startOffset = documentText.length + prefix.length;
		documentText += prefix + block.text;
		block.start_offset = startOffset;
		block.end_offset = documentText.length;
	}
	return documentText;
}

/**
 * Turn one or more HTML fragments (e.g. EPUB spine sections) into canonical `text` + `blocks`.
 */
export function buildReaderDocumentFromHtmlParts(
	htmlParts: string[],
	options?: ReaderHtmlToCanonicalOptions & { partBaseUrls?: (string | undefined)[] }
): {
	text: string;
	blocks: ReaderContentBlock[];
} {
	const blocks: ReaderContentBlock[] = [];
	for (let partIndex = 0; partIndex < htmlParts.length; partIndex += 1) {
		const part = htmlParts[partIndex];
		const partBaseUrl = options?.partBaseUrls?.[partIndex];
		const effectiveBaseUrl = partBaseUrl ?? options?.baseUrl;
		const combined = `<section data-reader-spine="1">${part}</section>`;
		const parsed = new DOMParser().parseFromString(combined, 'text/html');
		blocks.push(...walkRootToBlocks(parsed.body, { baseUrl: effectiveBaseUrl }));
	}
	const text = assignLinearOffsets(blocks);
	return { text, blocks };
}

export function buildReaderDocumentFromHtmlString(
	html: string,
	options?: ReaderHtmlToCanonicalOptions
): {
	text: string;
	blocks: ReaderContentBlock[];
} {
	const parsed = new DOMParser().parseFromString(html, 'text/html');
	const blocks = walkRootToBlocks(parsed.body, options);
	const text = assignLinearOffsets(blocks);
	return { text, blocks };
}

function buildImageBlock(
	imageElement: HTMLImageElement,
	imageBaseUrl: string | undefined
): ReaderContentBlock {
	const rawSource = pickBestRawImageSource(imageElement);
	const source = resolveImageSourceUrl(rawSource, imageBaseUrl);
	const altText = normalizeWhitespace(imageElement.getAttribute('alt') ?? '') || 'Image';
	const mimeMatch = source.match(/^data:([^;,]+)/i);
	const mimeType = mimeMatch?.[1]?.trim() || 'application/octet-stream';
	const width =
		imageElement.width > 0
			? imageElement.width
			: parseDimension(imageElement.getAttribute('width'));
	const height =
		imageElement.height > 0
			? imageElement.height
			: parseDimension(imageElement.getAttribute('height'));
	return {
		id: newBlockId(),
		kind: 'image',
		text: altText,
		participates_in_linear_text: false,
		extensions: {
			image: {
				asset_id: newBlockId(),
				mime_type: mimeType,
				width,
				height,
				inline_src: source || undefined,
			},
		},
	};
}

function textContentExcludingImages(element: HTMLElement): string {
	const clone = element.cloneNode(true) as HTMLElement;
	for (const imageNode of clone.querySelectorAll('img')) {
		imageNode.remove();
	}
	return clone.textContent ?? '';
}

function walkRootToBlocks(
	root: HTMLElement,
	options?: ReaderHtmlToCanonicalOptions
): ReaderContentBlock[] {
	const blocks: ReaderContentBlock[] = [];
	const imageBaseUrl = options?.baseUrl;

	function visitBlockOrRecurse(element: Element): void {
		if (!(element instanceof HTMLElement)) {
			return;
		}
		const tag = element.tagName;
		if (SKIP_TAGS.has(tag)) {
			return;
		}
		if (tag !== 'TABLE' && element.closest('table') !== null) {
			return;
		}

		if (tag === 'TABLE') {
			const tableExtension = extractTableExtension(element as HTMLTableElement);
			if (tableExtension.rows.length > 0) {
				blocks.push({
					id: newBlockId(),
					kind: 'table',
					text: '[Table]',
					participates_in_linear_text: false,
					extensions: { table: tableExtension },
				});
			}
			return;
		}

		if (tag === 'IMG') {
			blocks.push(buildImageBlock(element as HTMLImageElement, imageBaseUrl));
			return;
		}

		if (/^H[1-6]$/.test(tag)) {
			const headingLevel = Number(tag[1]) as 1 | 2 | 3 | 4 | 5 | 6;
			const displayText = normalizeWhitespace(element.textContent ?? '');
			if (!displayText) {
				return;
			}
			blocks.push({
				id: newBlockId(),
				kind: 'heading',
				text: displayText,
				participates_in_linear_text: true,
				heading_level: headingLevel,
			});
			return;
		}

		if (tag === 'UL' || tag === 'OL') {
			const listId = newBlockId();
			const ordered = tag === 'OL';
			let ordinal = 0;
			for (const item of element.querySelectorAll('li')) {
				const owningList = item.closest('ul, ol');
				if (owningList !== element) {
					continue;
				}
				ordinal += 1;
				const itemText = normalizeWhitespace(item.textContent ?? '');
				if (!itemText) {
					continue;
				}
				blocks.push({
					id: newBlockId(),
					kind: 'list_item',
					text: itemText,
					participates_in_linear_text: true,
					extensions: {
						list_item: {
							list_id: listId,
							nesting_depth: 0,
							list_style: ordered ? 'ordered' : 'bullet',
							ordinal: ordered ? ordinal : undefined,
						},
					},
				});
			}
			return;
		}

		if (tag === 'LI') {
			return;
		}

		if (tag === 'P' || tag === 'PRE') {
			const descendantImages = element.querySelectorAll('img');
			for (const descendantImage of descendantImages) {
				blocks.push(buildImageBlock(descendantImage as HTMLImageElement, imageBaseUrl));
			}
			const displayText = normalizeWhitespace(
				descendantImages.length > 0
					? textContentExcludingImages(element)
					: (element.textContent ?? '')
			);
			if (!displayText) {
				return;
			}
			blocks.push({
				id: newBlockId(),
				kind: tag === 'PRE' ? 'code_block' : 'paragraph',
				text: displayText,
				participates_in_linear_text: true,
			});
			return;
		}

		if (tag === 'BLOCKQUOTE') {
			const descendantImages = element.querySelectorAll('img');
			for (const descendantImage of descendantImages) {
				blocks.push(buildImageBlock(descendantImage as HTMLImageElement, imageBaseUrl));
			}
			const displayText = normalizeWhitespace(
				descendantImages.length > 0
					? textContentExcludingImages(element)
					: (element.textContent ?? '')
			);
			if (!displayText) {
				return;
			}
			blocks.push({
				id: newBlockId(),
				kind: 'blockquote',
				text: displayText,
				participates_in_linear_text: true,
			});
			return;
		}

		if (CONTAINER_TAGS.has(tag)) {
			for (const child of Array.from(element.children)) {
				visitBlockOrRecurse(child);
			}
		}
	}

	for (const child of Array.from(root.children)) {
		visitBlockOrRecurse(child);
	}

	if (blocks.length === 0) {
		const fallback = normalizeWhitespace(root.textContent ?? '');
		if (fallback) {
			blocks.push({
				id: newBlockId(),
				kind: 'paragraph',
				text: fallback,
				participates_in_linear_text: true,
			});
		}
	}

	return blocks;
}
