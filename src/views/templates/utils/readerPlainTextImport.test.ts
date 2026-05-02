import { expect, it } from 'vitest';
import {
	createPlainTextReaderImportPayload,
	inferPlainTextReaderTitle,
} from '@/utils/readerPlainTextImport.js';

it('creates a plain text reader import payload from pasted text', () => {
	const payload = createPlainTextReaderImportPayload(
		' Sample / Story ',
		'Title\r\n\r\n你好今天的天气还好。\r\nSecond line.'
	);

	expect(payload).toMatchObject({
		title: 'Sample / Story',
		file_name: 'Sample - Story.txt',
		source_type: 'plain_text',
		mime_type: 'text/plain',
		extractor_version: 1,
		color: '#ffffff',
		text: 'Title\n\n你好今天的天气还好。\nSecond line.',
	});
	expect(payload.blocks).toHaveLength(2);
	expect(payload.blocks[0]).toMatchObject({
		kind: 'heading',
		text: 'Title',
		start_offset: 0,
		end_offset: 6,
		participates_in_linear_text: true,
	});
	expect(payload.blocks[1]).toMatchObject({
		kind: 'paragraph',
		text: '你好今天的天气还好。\nSecond line.',
		start_offset: 7,
		end_offset: 30,
		participates_in_linear_text: true,
	});
	expect(payload.blocks[0].id).toMatch(/^[0-9a-f-]{36}$/i);
	expect(payload.blocks[1].id).toMatch(/^[0-9a-f-]{36}$/i);
});

it('keeps closing punctuation from making quoted sentences look like headings', () => {
	const payload = createPlainTextReaderImportPayload(
		'Quoted',
		'他笑着说：“这条巷子里的人平时看起来都很忙，但不代表他们没有心。”'
	);

	expect(payload.blocks).toHaveLength(1);
	expect(payload.blocks[0].kind).toBe('paragraph');
});

it('infers a title and preserves import options', () => {
	const title = inferPlainTextReaderTitle('\n Imported Heading \n\nBody');
	const payload = createPlainTextReaderImportPayload(title, 'Imported Heading\n\nBody', {
		color: '#91d7b4',
		fileName: 'webpage.txt',
		sourceType: 'webpage',
		sourceUrl: 'https://example.com/article',
	});

	expect(title).toBe('Imported Heading');
	expect(payload).toMatchObject({
		title: 'Imported Heading',
		file_name: 'webpage.txt',
		source_type: 'webpage',
		color: '#91d7b4',
		source_url: 'https://example.com/article',
	});
});
