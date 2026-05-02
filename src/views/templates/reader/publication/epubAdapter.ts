import { strFromU8, unzipSync } from 'fflate';
import DOMPurify from 'dompurify';
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

function getXmlText(document: Document, selector: string): string | undefined {
	return document.querySelector(selector)?.textContent?.trim();
}

function joinPath(basePath: string, href: string): string {
	if (!basePath) {
		return href;
	}
	return `${basePath.replace(/\/$/, '')}/${href.replace(/^\//, '')}`;
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
	return Array.from(manifest.values()).map((item) => {
		const href = joinPath(packageBasePath, item.href);
		const data = files[href];
		const isHtml = item.type === 'application/xhtml+xml' || item.type === 'text/html';
		return {
			href,
			type: item.type,
			kind: readingOrderHrefs.has(href) && isHtml ? 'reflowable-document' : 'asset',
			html:
				isHtml && data
					? DOMPurify.sanitize(strFromU8(data), { USE_PROFILES: { html: true } })
					: undefined,
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
