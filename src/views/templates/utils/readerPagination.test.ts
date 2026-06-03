import { expect, it } from 'vitest';
import {
	createReaderPages,
	createReaderSegments,
	findPageIndexForPosition,
	READER_IMAGE_MAX_HEIGHT_RATIO,
	READER_IMAGE_MAX_WIDTH_RATIO,
	type ReaderPageLayout,
} from '@/utils/readerPagination.js';
import type {
	ReaderDocument,
	ReaderExtractorVersion,
	ReaderSchemaVersion,
} from '@/types/reader.js';

const compactLayout: ReaderPageLayout = {
	contentWidth: 40,
	contentHeight: 20,
	fontSize: 10,
	lineHeight: 10,
	blockGap: 0,
	headingLineHeight: 10,
	headingGap: 0,
	averageCharacterWidth: 10,
};
const EXPECTED_PAGE_COUNT = 3;
const SECOND_PAGE_POSITION = 9;
const THIRD_PAGE_POSITION = 18;

function buildDocument(text: string): ReaderDocument {
	return {
		_id: 'reader-1',
		canonical_schema_version: 1 as ReaderSchemaVersion,
		title: 'Story',
		file_name: 'story.txt',
		source_type: 'plain_text',
		mime_type: 'text/plain',
		extractor_version: 1 as ReaderExtractorVersion,
		text,
		blocks: [
			{
				id: 'block-1',
				kind: 'paragraph',
				text,
				start_offset: 0,
				end_offset: text.length,
			},
		],
		imported_at: '2026-01-01T00:00:00.000Z',
		updated_at: '2026-01-01T00:00:00.000Z',
		reading_order: [{ href: 'text', type: 'text/plain', title: 'Story' }],
		progress: {
			resource_href: 'text',
			position: 0,
			total_progression: 0,
			page_index: 0,
			text_position: { start: 0, end: 0 },
			text_quote: { exact: '', prefix: '', suffix: '' },
			updated_at: '2026-01-01T00:00:00.000Z',
		},
	};
}

it('splits a long paragraph into viewport-sized page slices', () => {
	const document = buildDocument('abcdefghijklmnopqrst');

	const pages = createReaderPages(document, compactLayout);

	expect(pages).toHaveLength(EXPECTED_PAGE_COUNT);
	expect(pages[0].blocks[0].text).toBe('abcdefgh');
	expect(pages[1].blocks[0].text).toBe('ijklmnop');
	expect(pages[2].blocks[0].text).toBe('qrst');
	expect(pages.flatMap((page) => page.blocks.map((block) => block.text)).join('')).toBe(
		document.text
	);
});

it('restores progress by text position instead of saved page count', () => {
	const document = buildDocument('abcdefghijklmnopqrst');
	const pages = createReaderPages(document, compactLayout);

	expect(findPageIndexForPosition(pages, 0)).toBe(0);
	expect(findPageIndexForPosition(pages, SECOND_PAGE_POSITION)).toBe(1);
	expect(findPageIndexForPosition(pages, THIRD_PAGE_POSITION)).toBe(2);
});

it('segments dictionary tokens inside a sliced source block', () => {
	const document = buildDocument('一二三四五六七八');
	const pages = createReaderPages(document, {
		...compactLayout,
		contentWidth: 30,
		contentHeight: 10,
	});
	const secondPageBlock = pages[1].blocks[0];

	const segments = createReaderSegments(secondPageBlock, [
		{ text: '三四五', start: 2, end: 5, block_id: 'block-1' },
		{ text: '六七', start: 5, end: 7, block_id: 'block-1' },
	]);

	expect(secondPageBlock.text).toBe('四五六');
	expect(segments.map((segment) => segment.text).join('')).toBe(secondPageBlock.text);
	expect(
		segments.filter((segment) => segment.type === 'token').map((segment) => segment.text)
	).toEqual(['四五', '六']);
});

it('places non-linear table blocks as atomic layout segments', () => {
	const tableDocument: ReaderDocument = {
		_id: 'reader-table',
		canonical_schema_version: 1 as ReaderSchemaVersion,
		title: 'Table doc',
		file_name: 't.html',
		source_type: 'test',
		mime_type: 'text/plain',
		extractor_version: 1 as ReaderExtractorVersion,
		text: '',
		blocks: [
			{
				id: 'table-1',
				kind: 'table',
				text: '[Table]',
				participates_in_linear_text: false,
				extensions: {
					table: {
						rows: [
							{ cells: [{ text: '甲' }, { text: '乙' }] },
							{ cells: [{ text: '丙' }, { text: '丁' }] },
						],
					},
				},
			},
		],
		imported_at: '2026-01-01T00:00:00.000Z',
		updated_at: '2026-01-01T00:00:00.000Z',
		reading_order: [{ href: 'text', type: 'text/plain', title: 'Table doc' }],
		progress: {
			resource_href: 'text',
			position: 0,
			total_progression: 0,
			page_index: 0,
			text_position: { start: 0, end: 0 },
			text_quote: { exact: '', prefix: '', suffix: '' },
			updated_at: '2026-01-01T00:00:00.000Z',
		},
	};

	const pages = createReaderPages(tableDocument, compactLayout);

	expect(pages.length).toBeGreaterThanOrEqual(1);
	expect(pages[0].blocks.some((block) => block.layout_mode === 'atomic')).toBe(true);
	const atomicBlock = pages[0].blocks.find((block) => block.layout_mode === 'atomic');
	expect(atomicBlock?.kind).toBe('table');
	const segments = createReaderSegments(atomicBlock!, []);
	expect(segments[0]?.type).toBe('text');
});

it('estimates landscape image height from the reader image width cap', () => {
	const document = buildDocument('abcdefghij');
	document.blocks = [
		{
			id: 'image-1',
			kind: 'image',
			text: 'Landscape',
			participates_in_linear_text: false,
			extensions: {
				image: {
					asset_id: 'landscape',
					mime_type: 'image/png',
					width: 1000,
					height: 500,
				},
			},
		},
		{
			id: 'block-1',
			kind: 'paragraph',
			text: document.text,
			start_offset: 0,
			end_offset: document.text.length,
		},
	];

	const pages = createReaderPages(document, {
		...compactLayout,
		contentWidth: 100,
		contentHeight: 50,
	});

	expect(READER_IMAGE_MAX_WIDTH_RATIO).toBe(0.7);
	expect(pages).toHaveLength(1);
	expect(pages[0].blocks.map((block) => block.sourceBlockId)).toEqual(['image-1', 'block-1']);
});

it('caps portrait image height against the reader content height', () => {
	const document = buildDocument('abcdefghij');
	document.blocks = [
		{
			id: 'image-1',
			kind: 'image',
			text: 'Portrait',
			participates_in_linear_text: false,
			extensions: {
				image: {
					asset_id: 'portrait',
					mime_type: 'image/png',
					width: 10,
					height: 1000,
				},
			},
		},
		{
			id: 'block-1',
			kind: 'paragraph',
			text: document.text,
			start_offset: 0,
			end_offset: document.text.length,
		},
	];

	const pages = createReaderPages(document, {
		...compactLayout,
		contentWidth: 100,
		contentHeight: 75,
	});

	expect(READER_IMAGE_MAX_HEIGHT_RATIO).toBe(0.65);
	expect(pages).toHaveLength(1);
	expect(pages[0].blocks.map((block) => block.sourceBlockId)).toEqual(['image-1', 'block-1']);
});

it('uses measured atomic heights when an image renders taller than its estimate', () => {
	const document = buildDocument('abcdefghij');
	document.blocks = [
		{
			id: 'image-1',
			kind: 'image',
			text: 'Measured image',
			participates_in_linear_text: false,
			extensions: {
				image: {
					asset_id: 'measured',
					mime_type: 'image/png',
					width: 1000,
					height: 500,
				},
			},
		},
		{
			id: 'block-1',
			kind: 'paragraph',
			text: document.text,
			start_offset: 0,
			end_offset: document.text.length,
		},
	];

	const pages = createReaderPages(document, {
		...compactLayout,
		contentWidth: 100,
		contentHeight: 70,
		measuredAtomicBlockHeights: {
			'image-1': 61,
		},
	});

	expect(pages).toHaveLength(2);
	expect(pages[0].blocks.map((block) => block.sourceBlockId)).toEqual(['image-1']);
	expect(pages[1].blocks.map((block) => block.sourceBlockId)).toEqual(['block-1']);
});

it('moves tall tables to the next page when their estimate does not fit after text', () => {
	const document = buildDocument('abcdefghijklmnopqrst');
	document.blocks = [
		{
			id: 'block-1',
			kind: 'paragraph',
			text: document.text,
			start_offset: 0,
			end_offset: document.text.length,
		},
		{
			id: 'table-1',
			kind: 'table',
			text: '[Table]',
			participates_in_linear_text: false,
			extensions: {
				table: {
					rows: [
						{ cells: [{ text: '甲' }] },
						{ cells: [{ text: '乙' }] },
						{ cells: [{ text: '丙' }] },
						{ cells: [{ text: '丁' }] },
					],
				},
			},
		},
	];

	const pages = createReaderPages(document, {
		...compactLayout,
		contentWidth: 100,
		contentHeight: 55,
	});

	expect(pages).toHaveLength(2);
	expect(pages[0].blocks.map((block) => block.sourceBlockId)).toEqual(['block-1']);
	expect(pages[1].blocks.map((block) => block.sourceBlockId)).toEqual(['table-1']);
});

it('keeps thematic breaks and boxed blocks stable during pagination', () => {
	const document = buildDocument('');
	document.blocks = [
		{
			id: 'box-1',
			kind: 'aside',
			text: 'abcdefghijkl',
			start_offset: 0,
			end_offset: 12,
			extensions: {
				block_style: {
					boxed: true,
				},
			},
		},
		{
			id: 'rule-1',
			kind: 'thematic_break',
			text: '',
			participates_in_linear_text: false,
		},
	];
	document.text = 'abcdefghijkl';

	const pages = createReaderPages(document, {
		...compactLayout,
		contentWidth: 30,
		contentHeight: 20,
	});

	expect(pages[0].blocks[0]).toMatchObject({
		sourceBlockId: 'box-1',
		text: 'abcdefghijkl',
		layout_mode: 'flow',
	});
	const thematicBlock = pages
		.flatMap((page) => page.blocks)
		.find((block) => block.sourceBlockId === 'rule-1');
	expect(thematicBlock).toMatchObject({
		kind: 'thematic_break',
		layout_mode: 'atomic',
	});
});

it('segments ruby-safe visible text without pronunciation tokens', () => {
	const pageBlock = {
		id: 'ruby-1:0:2',
		sourceBlockId: 'ruby-1',
		kind: 'paragraph',
		text: '漢字',
		sourceText: '漢字',
		sourceStart: 0,
		sourceEnd: 2,
		start_offset: 0,
		end_offset: 2,
		layout_mode: 'flow' as const,
	};

	const segments = createReaderSegments(
		pageBlock,
		[
			{ text: '漢', start: 0, end: 1, block_id: 'ruby-1' },
			{ text: '字', start: 1, end: 2, block_id: 'ruby-1' },
		],
		[{ start: 0, end: 1, style: 'ruby', annotation: 'han' }]
	);

	expect(segments.map((segment) => segment.text).join('')).toBe('漢字');
	expect(segments.map((segment) => segment.token?.text).filter(Boolean)).not.toContain('han');
	expect(segments[0].annotation).toBe('han');
	expect(segments[1].annotation).toBeUndefined();
});

function hasLoneSurrogate(text: string): boolean {
	return /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(text);
}

it('gives consecutive atomic blocks distinct offsets so progress restores to the right page', () => {
	const document = buildDocument('');
	document.blocks = [
		{
			id: 'image-0',
			kind: 'image',
			text: 'Image 0',
			participates_in_linear_text: false,
			extensions: { image: { asset_id: 'image-0', mime_type: 'image/png', width: 100, height: 100 } },
		},
		{
			id: 'image-1',
			kind: 'image',
			text: 'Image 1',
			participates_in_linear_text: false,
			extensions: { image: { asset_id: 'image-1', mime_type: 'image/png', width: 100, height: 100 } },
		},
		{
			id: 'image-2',
			kind: 'image',
			text: 'Image 2',
			participates_in_linear_text: false,
			extensions: { image: { asset_id: 'image-2', mime_type: 'image/png', width: 100, height: 100 } },
		},
	];

	const pages = createReaderPages(document, {
		...compactLayout,
		measuredAtomicBlockHeights: { 'image-0': 20, 'image-1': 20, 'image-2': 20 },
	});

	expect(pages).toHaveLength(EXPECTED_PAGE_COUNT);
	expect(pages.map((page) => page.blocks[0].start_offset)).toEqual([0, 1, 2]);
	expect(findPageIndexForPosition(pages, 0)).toBe(0);
	expect(findPageIndexForPosition(pages, 1)).toBe(1);
	expect(findPageIndexForPosition(pages, 2)).toBe(2);
});

it('restores a position in a gap to the nearest preceding page, not the last page', () => {
	const pages = [
		{ index: 0, start: 0, end: 10, blocks: [] },
		{ index: 1, start: 10, end: 11, blocks: [] },
		{ index: 2, start: 50, end: 80, blocks: [] },
	];

	// 30 falls in the gap between page 1 (ends at 11) and page 2 (starts at 50).
	expect(findPageIndexForPosition(pages, 30)).toBe(1);
	// A position before the first page maps to page 0.
	expect(findPageIndexForPosition(pages, -5)).toBe(0);
	// Exact half-open matches still win.
	expect(findPageIndexForPosition(pages, 60)).toBe(2);
});

it('never splits an astral-plane character across a line boundary', () => {
	// U+20BB7 (CJK Extension B) is two UTF-16 code units; a 3-code-unit line width would
	// otherwise slice through the middle of a surrogate pair.
	const document = buildDocument('𠮷𠮷𠮷');
	const pages = createReaderPages(document, {
		...compactLayout,
		contentWidth: 30,
		contentHeight: 10,
	});

	const sliceTexts = pages.flatMap((page) => page.blocks.map((block) => block.text));
	expect(sliceTexts.join('')).toBe('𠮷𠮷𠮷');
	for (const sliceText of sliceTexts) {
		expect(hasLoneSurrogate(sliceText)).toBe(false);
	}
});

it('reserves more vertical space for headings than body text of the same length', () => {
	const text = 'abcdefgh';
	const layout: ReaderPageLayout = {
		...compactLayout,
		contentWidth: 40,
		contentHeight: 25,
		averageCharacterWidth: 10,
		lineHeight: 10,
		headingLineHeight: 10,
		headingFontScale: 2,
	};

	const bodyPages = createReaderPages(buildDocument(text), layout);

	const headingDocument = buildDocument(text);
	headingDocument.blocks = [
		{ id: 'h1', kind: 'heading', text, start_offset: 0, end_offset: text.length },
	];
	const headingPages = createReaderPages(headingDocument, layout);

	expect(bodyPages).toHaveLength(1);
	expect(headingPages.length).toBeGreaterThan(bodyPages.length);
});
