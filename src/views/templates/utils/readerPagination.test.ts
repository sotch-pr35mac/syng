import { expect, it } from 'vitest';
import {
	createReaderPages,
	createReaderSegments,
	findPageIndexForPosition,
	type ReaderPageLayout,
} from '@/utils/readerPagination.js';
import type { ReaderDocument } from '@/types/reader.js';

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
		canonical_schema_version: 1,
		title: 'Story',
		file_name: 'story.txt',
		source_type: 'plain_text',
		mime_type: 'text/plain',
		extractor_version: 1,
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
		canonical_schema_version: 1,
		title: 'Table doc',
		file_name: 't.html',
		source_type: 'test',
		mime_type: 'text/plain',
		extractor_version: 1,
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

	const segments = createReaderSegments(pageBlock, [
		{ text: '漢', start: 0, end: 1, block_id: 'ruby-1' },
		{ text: '字', start: 1, end: 2, block_id: 'ruby-1' },
	]);

	expect(segments.map((segment) => segment.text).join('')).toBe('漢字');
	expect(segments.map((segment) => segment.token?.text).filter(Boolean)).not.toContain('han');
});
