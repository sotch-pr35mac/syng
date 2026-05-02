import { fetch } from '@tauri-apps/plugin-http';
import { Readability } from '@mozilla/readability';
import type { ReaderImportPayload } from '@/types/reader.js';
import { sanitizeReflowableReaderHtml } from '@/utils/readerHtmlSanitize.js';

const WEBPAGE_SOURCE_TYPE = 'webpage';
const WEBPAGE_MIME_TYPE = 'text/html';

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

export function createWebpageReaderImportPayload(
	title: string,
	html: string,
	sourceUrl: string,
	color: string
): ReaderImportPayload {
	const extracted = extractWebpageTitle(html, sourceUrl);
	return {
		title,
		file_name: createWebpageFileName(sourceUrl),
		source_type: WEBPAGE_SOURCE_TYPE,
		mime_type: WEBPAGE_MIME_TYPE,
		extractor_version: 1,
		text: extracted.text,
		blocks: [],
		color,
		source_url: sourceUrl,
		source_html: sanitizeReflowableReaderHtml(html),
	};
}
