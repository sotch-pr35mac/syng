import { fetch } from '@tauri-apps/plugin-http';
import { Readability } from '@mozilla/readability';
import type { ReaderImportPayload } from '@/types/reader.js';
import { buildReaderDocumentFromHtmlString } from '@/utils/readerHtmlToCanonical.js';
import { sanitizeReflowableReaderHtml } from '@/utils/readerHtmlSanitize.js';

const WEBPAGE_SOURCE_TYPE = 'webpage';
const WEBPAGE_MIME_TYPE = 'text/html';
const MAX_INLINED_IMAGE_BYTES = 4 * 1024 * 1024;
const EMBED_IMAGE_CONCURRENCY = 10;
const IMAGE_FETCH_TIMEOUT_MS = 8_000;

function normalizeWebpageUrl(rawUrl: string): string {
	const trimmedUrl = rawUrl.trim();
	if (/^https?:\/\//i.test(trimmedUrl)) {
		return trimmedUrl;
	}
	return `https://${trimmedUrl}`;
}

function createWebpageFileName(url: string): string {
	const { hostname, pathname } = new URL(url);
	const pathName = decodeURIComponent(pathname.split('/').filter(Boolean).at(-1) ?? '');
	return `${pathName || hostname || 'webpage'}.html`;
}

function pickFirstSrcsetCandidate(srcset: string | null | undefined): string | undefined {
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

function arrayBufferToDataUrl(buffer: ArrayBuffer, mimeType: string): string {
	const bytes = new Uint8Array(buffer);
	let binary = '';
	const chunkSize = 0x8000;
	for (let index = 0; index < bytes.length; index += chunkSize) {
		binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
	}
	return `data:${mimeType};base64,${btoa(binary)}`;
}

function inferImageMimeFromMagicBytes(bytes: Uint8Array): string | undefined {
	if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
		return 'image/jpeg';
	}
	if (
		bytes.length >= 4 &&
		bytes[0] === 0x89 &&
		bytes[1] === 0x50 &&
		bytes[2] === 0x4e &&
		bytes[3] === 0x47
	) {
		return 'image/png';
	}
	if (bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
		return 'image/gif';
	}
	if (bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
		return 'image/webp';
	}
	return undefined;
}

async function fetchRemoteImageAsDataUrl(imageUrl: string): Promise<string | undefined> {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), IMAGE_FETCH_TIMEOUT_MS);
	try {
		const response = await fetch(imageUrl, {
			method: 'GET',
			headers: {
				Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
			},
			signal: controller.signal,
		});
		if (!response.ok) {
			return undefined;
		}
		const contentLengthHeader = response.headers.get('content-length');
		if (contentLengthHeader) {
			const parsedLength = Number(contentLengthHeader);
			if (Number.isFinite(parsedLength) && parsedLength > MAX_INLINED_IMAGE_BYTES) {
				return undefined;
			}
		}
		const buffer = await response.arrayBuffer();
		if (buffer.byteLength > MAX_INLINED_IMAGE_BYTES) {
			return undefined;
		}
		const headerMime =
			response.headers.get('content-type')?.split(';')[0]?.trim() || 'application/octet-stream';
		const bytes = new Uint8Array(buffer);
		const mimeType = headerMime.startsWith('image/')
			? headerMime
			: (inferImageMimeFromMagicBytes(bytes) ?? 'image/png');
		return arrayBufferToDataUrl(buffer, mimeType);
	} catch {
		return undefined;
	} finally {
		clearTimeout(timeoutId);
	}
}

/**
 * Inlines remote images as data URLs so the reader can display them from the Tauri webview
 * (cross-origin <img src> to the article host is often blocked; import-time fetch uses the HTTP plugin).
 */
async function embedArticleImagesAsDataUrls(
	articleHtml: string,
	sourceUrl: string
): Promise<string> {
	if (!articleHtml.trim()) {
		return articleHtml;
	}
	const parsed = new DOMParser().parseFromString(
		`<div id="syng-article-root">${articleHtml}</div>`,
		'text/html'
	);
	const root = parsed.getElementById('syng-article-root');
	if (!root) {
		return articleHtml;
	}
	const imageElements = Array.from(root.querySelectorAll('img'));
	for (
		let batchStart = 0;
		batchStart < imageElements.length;
		batchStart += EMBED_IMAGE_CONCURRENCY
	) {
		const batch = imageElements.slice(batchStart, batchStart + EMBED_IMAGE_CONCURRENCY);
		await Promise.all(
			batch.map(async (imageElement) => {
				const rawSource =
					imageElement.getAttribute('src')?.trim() ||
					imageElement.getAttribute('data-src')?.trim() ||
					imageElement.getAttribute('data-lazy-src')?.trim() ||
					imageElement.getAttribute('data-original')?.trim() ||
					imageElement.getAttribute('data-orig-src')?.trim() ||
					pickFirstSrcsetCandidate(imageElement.getAttribute('srcset')) ||
					'';
				if (!rawSource || /^data:/i.test(rawSource) || /^blob:/i.test(rawSource)) {
					return;
				}
				let absoluteUrl: string;
				try {
					absoluteUrl = new URL(rawSource, sourceUrl).href;
				} catch {
					return;
				}
				if (!/^https?:/i.test(absoluteUrl)) {
					return;
				}
				const dataUrl = await fetchRemoteImageAsDataUrl(absoluteUrl);
				if (dataUrl) {
					imageElement.setAttribute('src', dataUrl);
					imageElement.removeAttribute('srcset');
					imageElement.removeAttribute('data-src');
					imageElement.removeAttribute('data-lazy-src');
					imageElement.removeAttribute('data-original');
					imageElement.removeAttribute('data-orig-src');
				}
			})
		);
	}
	return root.innerHTML;
}

function extractWebpageTitle(html: string, sourceUrl: string): { title: string; text: string } {
	const document = new DOMParser().parseFromString(html, 'text/html');
	const baseElement = document.createElement('base');
	baseElement.href = sourceUrl;
	document.head.append(baseElement);

	const article = new Readability(document).parse();
	return {
		title: article?.title?.trim() || document.title.trim() || new URL(sourceUrl).hostname,
		text: (article?.textContent || document.body.textContent || '').trim(),
	};
}

export async function fetchReadableWebpage(
	rawUrl: string
): Promise<{ sourceUrl: string; title: string; html: string; text: string }> {
	const sourceUrl = normalizeWebpageUrl(rawUrl);
	const response = await fetch(sourceUrl, {
		method: 'GET',
		headers: {
			Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
		},
	});
	if (!response.ok) {
		throw new Error(`Unable to fetch webpage (${response.status}).`);
	}

	const html = await response.text();
	const extracted = extractWebpageTitle(html, sourceUrl);

	if (!extracted.text) {
		throw new Error('The webpage did not contain readable text.');
	}

	return { sourceUrl, html, ...extracted };
}

/** Readability picks article HTML; images are inlined for display; `readerHtmlToCanonical` builds blocks. */
export async function createWebpageReaderImportPayload(
	userTitle: string,
	html: string,
	sourceUrl: string,
	color: string
): Promise<ReaderImportPayload> {
	const sanitizedHtml = sanitizeReflowableReaderHtml(html);
	const parsed = new DOMParser().parseFromString(sanitizedHtml, 'text/html');
	const baseElement = parsed.createElement('base');
	baseElement.href = sourceUrl;
	parsed.head.append(baseElement);
	const article = new Readability(parsed).parse();
	const resolvedTitle =
		userTitle.trim() ||
		article?.title?.trim() ||
		parsed.title.trim() ||
		new URL(sourceUrl).hostname;
	let articleHtml = article?.content ?? parsed.body?.innerHTML ?? '';
	articleHtml = await embedArticleImagesAsDataUrls(articleHtml, sourceUrl);
	const { text, blocks } = buildReaderDocumentFromHtmlString(articleHtml, {
		baseUrl: sourceUrl,
	});
	return {
		canonical_schema_version: 1,
		title: resolvedTitle,
		file_name: createWebpageFileName(sourceUrl),
		source_type: WEBPAGE_SOURCE_TYPE,
		mime_type: WEBPAGE_MIME_TYPE,
		extractor_version: 1,
		text,
		blocks,
		color,
		source_url: sourceUrl,
		source_html: sanitizedHtml,
	};
}
