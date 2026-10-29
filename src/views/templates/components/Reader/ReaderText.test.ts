import { expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/svelte';
import ReaderText from '@/components/Reader/ReaderText.svelte';
import { createReaderSegments, type ReaderPageBlock } from '@/utils/readerPagination.js';
import { layoutReaderText } from '@/utils/readerTextLayout.js';

function block(text: string): ReaderPageBlock {
	return {
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
}

it('preserves exact source spaces and newlines when pinyin is off', () => {
	const text = '学习中文， Hello  world。\n再次阅读\n';
	const segments = createReaderSegments(block(text), [
		{ text: '学习', start: 0, end: 2 },
		{ text: '中文', start: 2, end: 4 },
		{ text: '再次', start: 21, end: 23 },
	]);
	const { container } = render(ReaderText, { segments, onopen: vi.fn() });
	expect(container.textContent).toBe(text);
	expect(container.querySelector('.reader-text-line')).toBeNull();
});

for (const measured of [false, true]) {
	it(`keeps separate lookup targets within one authored annotation (${measured ? 'pinyin on' : 'native flow'})`, async () => {
		const segments = createReaderSegments(
			block('学习中文'),
			[
				{ text: '学习', start: 0, end: 2 },
				{ text: '中文', start: 2, end: 4 },
			],
			[{ start: 0, end: 4, style: 'ruby', annotation: 'xué xí zhōng wén' }]
		);
		const onopen = vi.fn();
		const { container, getByRole } = render(ReaderText, {
			segments,
			onopen,
			lines: measured
				? layoutReaderText(segments, {
						width: 300,
						fontSize: 20,
						lineHeight: 40,
						fontFamily: 'sans-serif',
					})
				: undefined,
		});
		expect(container.querySelectorAll(measured ? '.reader-pronunciation' : 'rt')).toHaveLength(
			1
		);
		await fireEvent.click(getByRole('button', { name: '中文' }));
		expect(onopen.mock.calls[0][1]).toMatchObject({ text: '中文', start: 2, end: 4 });
		const copy = container.cloneNode(true) as HTMLElement;
		copy.querySelectorAll('rt, .reader-pronunciation').forEach((node) => node.remove());
		expect(copy.textContent).toBe('学习中文');
	});
}
