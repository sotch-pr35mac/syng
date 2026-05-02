import { strFromU8, unzipSync } from 'fflate';
import { sanitizeReflowableReaderHtml } from '@/utils/readerHtmlSanitize.js';
import type { ReaderPublication, ReaderReadingOrderItem, ReaderResource } from '@/reader/types.js';
import {
	createDefaultCapabilities,
	createDefaultMetadata,
	createPublicationSource,
	type ReaderAdapterInput,
	type ReaderFormatAdapter,
} from '@/reader/publication/adapters.js';

interface EpubManifestItem {
	id: string;
	href: string;
	type: string;
	properties?: string;
}

function asUint8Array(data: ArrayBuffer | Uint8Array): Uint8Array {
	return data instanceof Uint8Array ? data : new Uint8Array(data);
}

function copyArrayBuffer(data: Uint8Array): ArrayBuffer {
	const copy = new Uint8Array(data.byteLength);
	copy.set(data);
	return copy.buffer;
}

function bytesToBase64(data: Uint8Array): string {
	let binary = '';
	const chunkSize = 0x8000;
	for (let index = 0; index < data.length; index += chunkSize) {
		binary += String.fromCharCode(...data.subarray(index, index + chunkSize));
	}
	return btoa(binary);
}

function createDataUrl(data: Uint8Array, type: string): string {
	return `data:${type};base64,${bytesToBase64(data)}`;
}

function getXmlText(document: Document, selector: string): string | undefined {
	return document.querySelector(selector)?.textContent?.trim();
}

function joinPath(basePath: string, href: string): string {
	if (!basePath) {
		return href;
	}
	return `${basePath.replace(/\/$/, '')}/${href.replace(/^\//, '')}`;
}

function resolveEpubPath(basePath: string, href: string): string {
	if (/^(?:[a-z]+:|#)/i.test(href)) {
		return href;
	}
	const [path, suffix = ''] = href.split(/(?=[#?])/);
	const combinedPath = joinPath(basePath, path);
	const segments: string[] = [];
	for (const segment of combinedPath.split('/')) {
		if (!segment || segment === '.') {
			continue;
		}
		if (segment === '..') {
			segments.pop();
			continue;
		}
		segments.push(segment);
	}
	return `${segments.join('/')}${suffix}`;
}

function rewriteCssUrls(
	css: string,
	basePath: string,
	files: Record<string, Uint8Array>,
	manifestByHref: Map<string, EpubManifestItem>
): string {
	return css.replace(/url\((['"]?)([^'")]+)\1\)/g, (match, quote, href) => {
		const resourcePath = resolveEpubPath(basePath, href);
		const manifestItem = manifestByHref.get(resourcePath);
		const data = files[resourcePath];
		if (!manifestItem || !data) {
			return match;
		}
		return `url(${quote}${createDataUrl(data, manifestItem.type)}${quote})`;
	});
}

function createHtmlResource(
	files: Record<string, Uint8Array>,
	href: string,
	manifestByHref: Map<string, EpubManifestItem>
): string | undefined {
	const data = files[href];
	if (!data) {
		return undefined;
	}
	const basePath = href.split('/').slice(0, -1).join('/');
	const document = new DOMParser().parseFromString(strFromU8(data), 'text/html');

	for (const link of Array.from(document.querySelectorAll('link[rel~="stylesheet"][href]'))) {
		const stylesheetHref = resolveEpubPath(basePath, link.getAttribute('href') ?? '');
		const stylesheetItem = manifestByHref.get(stylesheetHref);
		const stylesheetData = files[stylesheetHref];
		if (!stylesheetItem || !stylesheetData) {
			continue;
		}
		const style = document.createElement('style');
		style.textContent = rewriteCssUrls(
			strFromU8(stylesheetData),
			stylesheetHref.split('/').slice(0, -1).join('/'),
			files,
			manifestByHref
		);
		link.replaceWith(style);
	}

	for (const style of Array.from(document.querySelectorAll('style'))) {
		style.textContent = rewriteCssUrls(
			style.textContent ?? '',
			basePath,
			files,
			manifestByHref
		);
	}

	for (const element of Array.from(document.querySelectorAll('[src]'))) {
		const sourcePath = resolveEpubPath(basePath, element.getAttribute('src') ?? '');
		const manifestItem = manifestByHref.get(sourcePath);
		const sourceData = files[sourcePath];
		if (manifestItem && sourceData) {
			element.setAttribute('src', createDataUrl(sourceData, manifestItem.type));
		}
	}

	const content = document.body.innerHTML || document.documentElement.innerHTML;
	return sanitizeReflowableReaderHtml(content, { allowStyleTag: true });
}

function getPackagePath(files: Record<string, Uint8Array>): string {
	const containerXml = files['META-INF/container.xml'];
	if (!containerXml) {
		throw new Error('EPUB container.xml is missing.');
	}

	const containerDocument = new DOMParser().parseFromString(
		strFromU8(containerXml),
		'application/xml'
	);
	const rootFilePath = containerDocument.querySelector('rootfile')?.getAttribute('full-path');
	if (!rootFilePath) {
		throw new Error('EPUB package document path is missing.');
	}
	return rootFilePath;
}

function parseManifest(packageDocument: Document): Map<string, EpubManifestItem> {
	const manifest = new Map<string, EpubManifestItem>();
	for (const item of packageDocument.querySelectorAll('manifest > item')) {
		const id = item.getAttribute('id');
		const href = item.getAttribute('href');
		const type = item.getAttribute('media-type');
		if (!id || !href || !type) {
			continue;
		}
		manifest.set(id, {
			id,
			href,
			type,
			properties: item.getAttribute('properties') ?? undefined,
		});
	}
	return manifest;
}

function createReadingOrder(
	packageDocument: Document,
	manifest: Map<string, EpubManifestItem>,
	packageBasePath: string
): ReaderReadingOrderItem[] {
	return Array.from(packageDocument.querySelectorAll('spine > itemref'))
		.map((itemRef) => manifest.get(itemRef.getAttribute('idref') ?? ''))
		.filter((item): item is EpubManifestItem => Boolean(item))
		.map((item) => ({
			href: joinPath(packageBasePath, item.href),
			type: item.type,
		}));
}

function createResources(
	files: Record<string, Uint8Array>,
	manifest: Map<string, EpubManifestItem>,
	packageBasePath: string,
	readingOrderHrefs: Set<string>
): ReaderResource[] {
	const manifestByHref = new Map(
		Array.from(manifest.values()).map((item) => [joinPath(packageBasePath, item.href), item])
	);
	return Array.from(manifest.values()).map((item) => {
		const href = joinPath(packageBasePath, item.href);
		const data = files[href];
		const isHtml = item.type === 'application/xhtml+xml' || item.type === 'text/html';
		return {
			href,
			type: item.type,
			kind: readingOrderHrefs.has(href) && isHtml ? 'reflowable-document' : 'asset',
			html: isHtml ? createHtmlResource(files, href, manifestByHref) : undefined,
			data: !isHtml && data ? copyArrayBuffer(data) : undefined,
			properties: item.properties ? { properties: item.properties } : undefined,
		};
	});
}

export const epubPublicationAdapter: ReaderFormatAdapter = {
	format: 'epub',
	canOpen(input: ReaderAdapterInput): boolean {
		return (
			Boolean(input.data) &&
			(input.mimeType === 'application/epub+zip' || input.fileName?.endsWith('.epub'))
		);
	},
	async open(input: ReaderAdapterInput): Promise<ReaderPublication> {
		if (!input.data) {
			throw new Error('EPUB data is required.');
		}

		const files = unzipSync(asUint8Array(input.data));
		const packagePath = getPackagePath(files);
		const packageData = files[packagePath];
		if (!packageData) {
			throw new Error('EPUB package document is missing.');
		}

		const packageBasePath = packagePath.split('/').slice(0, -1).join('/');
		const packageDocument = new DOMParser().parseFromString(
			strFromU8(packageData),
			'application/xml'
		);
		const manifest = parseManifest(packageDocument);
		const readingOrder = createReadingOrder(packageDocument, manifest, packageBasePath);
		const resources = createResources(
			files,
			manifest,
			packageBasePath,
			new Set(readingOrder.map((item) => item.href))
		);

		return {
			id: input.id,
			format: 'epub',
			metadata: {
				...createDefaultMetadata(input),
				title:
					input.title ??
					getXmlText(packageDocument, 'metadata > title, dc\\:title') ??
					input.fileName ??
					'EPUB',
				author: getXmlText(packageDocument, 'metadata > creator, dc\\:creator'),
				language: getXmlText(packageDocument, 'metadata > language, dc\\:language'),
			},
			source: createPublicationSource(input, 'epub'),
			readingOrder,
			resources,
			capabilities: createDefaultCapabilities({
				reflowable: true,
				hasTextLayer: true,
				supportsDictionaryLookup: true,
				supportsThemes: true,
			}),
		};
	},
};
