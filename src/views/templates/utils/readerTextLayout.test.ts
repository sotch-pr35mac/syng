import { expect, it } from 'vitest';
import {
	createReaderPages,
	createReaderSegments,
	type ReaderPageBlock,
} from '@/utils/readerPagination.js';
import { layoutReaderText } from '@/utils/readerTextLayout.js';
import type { ReaderDocument, ReaderToken } from '@/types/reader.js';

const text = '学习中文🙂！';
const block: ReaderPageBlock = {
	id: 'b',
	sourceBlockId: 'b',
	kind: 'paragraph',
	text,
	sourceText: text,
	sourceStart: 0,
	sourceEnd: text.length,
	start_offset: 0,
	end_offset: text.length,
};
const tokens: ReaderToken[] = [
	{
		text: '学习',
		start: 0,
		end: 2,
		pinyin: { marks: 'xué xí', numbers: 'xue2xi2', tones: [2, 2] },
	},
	{
		text: '中文',
		start: 2,
		end: 4,
		pinyin: { marks: 'zhōng wén', numbers: 'zhong1wen2', tones: [1, 2] },
	},
];
const metrics = { width: 48, fontSize: 20, lineHeight: 40, fontFamily: 'sans-serif' };

it('retains author annotations while independently toggling generated pinyin', () => {
	const spans = [{ start: 0, end: 2, style: 'ruby', annotation: 'author reading' }];
	const off = createReaderSegments(block, tokens, spans, false);
	expect(
		off.filter((segment) => segment.annotation).map((segment) => segment.annotation)
	).toEqual(['author reading']);
	const on = createReaderSegments(block, tokens, spans, true);
	expect(on.filter((segment) => segment.annotation).map((segment) => segment.annotation)).toEqual(
		['author reading', 'zhōng wén']
	);
	expect(on.map((segment) => segment.text).join('')).toBe(text);
	expect(on[1].token).toMatchObject({ text: '中文', start: 2, end: 4 });
});

it('keeps annotated words together and preserves UTF-16 positions through pagination', () => {
	const segments = createReaderSegments(block, tokens, [], true);
	const lines = layoutReaderText(segments, metrics);
	expect(lines[0].end).toBe(2);
	expect(
		lines
			.flatMap((line) => line.runs)
			.map((run) => run.text)
			.join('')
	).toBe(text);
	expect(lines.at(-1)?.end).toBe(text.length);
	expect(
		lines.every(
			(line) =>
				line.height > 0 &&
				line.runs.reduce((width, run) => width + run.width, 0) <= metrics.width
		)
	).toBe(true);
	const document = {
		text,
		blocks: [{ id: 'b', kind: 'paragraph', text, start_offset: 0, end_offset: text.length }],
	} as ReaderDocument;
	const pages = createReaderPages(
		document,
		{
			contentWidth: 48,
			contentHeight: 70,
			fontSize: 20,
			lineHeight: 40,
			blockGap: 0,
			headingLineHeight: 40,
			headingGap: 0,
		},
		{ b: lines }
	);
	expect(
		pages
			.flatMap((page) => page.blocks)
			.map((item) => item.text)
			.join('')
	).toBe(text);
	expect(pages.flatMap((page) => page.blocks).every((item) => item.textLines?.length)).toBe(true);
	expect(pages.every((page) => ![1, 3, 5].includes(page.end))).toBe(true);
});

it('bounds exceptionally long annotations and includes their full height', () => {
	const lines = layoutReaderText(
		[
			{
				type: 'text',
				text: '字',
				annotation: 'a very long pronunciation annotation',
				annotationSource: 'imported',
			},
		],
		metrics
	);
	expect(lines[0].runs[0].width).toBe(metrics.width);
	expect(lines[0].above).toBeGreaterThan(20);
	expect(lines[0].height).toBeGreaterThan(metrics.lineHeight + 20);
});

it('accepts null spans serialized by native plain-text imports', () => {
	const segments = createReaderSegments(block, tokens, null, true);
	expect(
		segments.filter((segment) => segment.annotation).map((segment) => segment.annotation)
	).toEqual(['xué xí', 'zhōng wén']);
});

it('fits pinyin into the existing Reader line leading instead of adding it twice', () => {
	const lines = layoutReaderText(createReaderSegments(block, tokens, [], true), {
		...metrics,
		width: 200,
	});
	expect(lines).toHaveLength(1);
	expect(lines[0].height).toBe(metrics.lineHeight);
	for (const run of lines[0].runs) {
		expect(run.baseHeight + run.annotationHeight).toBeLessThanOrEqual(lines[0].height);
	}
});

it('reserves first-line indentation without indenting continuation lines or pages', () => {
	const source = '学习中文学习中文';
	const document = {
		text: source,
		blocks: [
			{
				id: 'b',
				kind: 'paragraph',
				text: source,
				start_offset: 0,
				end_offset: source.length,
			},
		],
	} as ReaderDocument;
	const lines = layoutReaderText([{ type: 'text', text: source }], {
		...metrics,
		width: 100,
		textIndent: 40,
	});
	expect(lines.map((line) => line.runs.map((run) => run.text).join(''))).toEqual([
		'学习中',
		'文学习中文',
	]);
	expect(lines.map((line) => line.indent)).toEqual([40, 0]);
	const pages = createReaderPages(
		document,
		{
			contentWidth: 100,
			contentHeight: 40,
			fontSize: 20,
			lineHeight: 40,
			blockGap: 0,
			headingLineHeight: 40,
			headingGap: 0,
		},
		{ b: lines }
	);
	expect(pages).toHaveLength(2);
	expect(pages[0].blocks[0].textLines[0].indent).toBe(40);
	expect(pages[1].blocks[0].textLines[0].indent).toBe(0);
});
