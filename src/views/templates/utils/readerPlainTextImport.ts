import type { ReaderContentBlock, ReaderImportPayload } from '@/types/reader.js';
import { normalizeReaderDocumentColor } from '@/utils/readerDocumentMetadata.js';

const TEXT_EXTRACTOR_VERSION = 1;
const HEADING_WORD_LIMIT = 12;
const FILE_NAME_STEM_LIMIT = 80;
const CLOSING_PUNCTUATION = [
	'"',
	"'",
	'”',
	'’',
	'」',
	'』',
	'》',
	'〉',
	'】',
	'〗',
	')',
	']',
	'）',
	'］',
];

function normalizeLineEndings(text: string): string {
	return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function inferBlockKind(text: string): string {
	const trimmed = text.trim();
	let inner = trimmed;
	while (inner && CLOSING_PUNCTUATION.includes(inner.at(-1) ?? '')) {
		inner = inner.slice(0, -1);
	}
	const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
	return !/[.!?。！？]$/.test(inner) && wordCount > 0 && wordCount <= HEADING_WORD_LIMIT
		? 'heading'
		: 'paragraph';
}

function pushTextBlock(
	blocks: ReaderContentBlock[],
	startOffset: number,
	endOffset: number,
	lines: string[]
): void {
	const text = lines.join('\n');
	blocks.push({
		id: `block-${blocks.length}`,
		kind: inferBlockKind(text),
		text,
		start_offset: startOffset,
		end_offset: endOffset,
	});
}

function extractTextBlocks(text: string): ReaderContentBlock[] {
	const blocks: ReaderContentBlock[] = [];
	let blockStart: number | undefined;
	let blockLines: string[] = [];
	let cursor = 0;

	for (const match of text.matchAll(/[^\n]*(?:\n|$)/g)) {
		const line = match[0];
		if (line === '') {
			continue;
		}
		const lineWithoutBreak = line.endsWith('\n') ? line.slice(0, -1) : line;
		const lineStart = cursor;
		const lineEnd = cursor + line.length;

		if (lineWithoutBreak.trim().length === 0) {
			if (blockStart !== undefined) {
				pushTextBlock(blocks, blockStart, lineStart, blockLines);
				blockStart = undefined;
				blockLines = [];
			}
		} else {
			blockStart ??= lineStart;
			blockLines.push(lineWithoutBreak);
		}

		cursor = lineEnd;
	}

	if (blockStart !== undefined) {
		pushTextBlock(blocks, blockStart, text.length, blockLines);
	}

	if (!blocks.length && text.trim().length === 0) {
		blocks.push({
			id: 'block-0',
			kind: 'paragraph',
			text: '',
			start_offset: 0,
			end_offset: text.length,
		});
	}

	return blocks;
}

function createClipboardFileName(title: string): string {
	const stem = title
		.trim()
		.replace(/[\\/:*?"<>|]/g, '-')
		.replace(/\s+/g, ' ')
		.slice(0, FILE_NAME_STEM_LIMIT);
	return `${stem || 'Untitled'}.txt`;
}

export function inferPlainTextReaderTitle(rawText: string): string {
	const text = normalizeLineEndings(rawText);
	const firstLine = text
		.split('\n')
		.map((line) => line.trim())
		.find(Boolean);
	return firstLine?.slice(0, FILE_NAME_STEM_LIMIT) ?? '';
}

export function createPlainTextReaderImportPayload(
	title: string,
	rawText: string,
	options: {
		color?: string;
		fileName?: string;
		mimeType?: string;
		sourceType?: string;
		sourceUrl?: string;
	} = {}
): ReaderImportPayload {
	const normalizedTitle = title.trim() || 'Untitled';
	const text = normalizeLineEndings(rawText);
	return {
		title: normalizedTitle,
		file_name: options.fileName ?? createClipboardFileName(normalizedTitle),
		source_type: options.sourceType ?? 'plain_text',
		mime_type: options.mimeType ?? 'text/plain',
		extractor_version: TEXT_EXTRACTOR_VERSION,
		text,
		blocks: extractTextBlocks(text),
		color: normalizeReaderDocumentColor(options.color),
		source_url: options.sourceUrl,
	};
}
