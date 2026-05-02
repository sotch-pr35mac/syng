import { expect, it } from 'vitest';
import { buildReaderDocumentFromHtmlString } from '@/utils/readerHtmlToCanonical.js';

it('maps headings, paragraphs, and tables into canonical blocks', () => {
	const html = `
    <article>
      <h2>Chapter</h2>
      <p>First line.</p>
      <table><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></table>
    </article>
  `;
	const { text, blocks } = buildReaderDocumentFromHtmlString(html);

	expect(blocks.map((block) => block.kind)).toEqual(['heading', 'paragraph', 'table']);
	expect(blocks[0].heading_level).toBe(2);
	expect(blocks[0].text).toBe('Chapter');
	expect(blocks[2].extensions?.table?.rows).toHaveLength(2);
	expect(text.length).toBeGreaterThan(0);
});

it('resolves relative image URLs against baseUrl', () => {
	const html = '<figure><img src="/images/hero.png" alt="Hero"></figure>';
	const { blocks } = buildReaderDocumentFromHtmlString(html, {
		baseUrl: 'https://example.com/articles/post/',
	});
	const imageBlock = blocks.find((block) => block.kind === 'image');
	expect(imageBlock?.extensions?.image?.inline_src).toBe('https://example.com/images/hero.png');
});

it('maps ul/ol list items with list extensions', () => {
	const html = '<ul><li>Alpha</li><li>Beta</li></ul><ol><li>One</li><li>Two</li></ol>';
	const { blocks } = buildReaderDocumentFromHtmlString(html);
	expect(blocks.map((block) => block.kind)).toEqual([
		'list_item',
		'list_item',
		'list_item',
		'list_item',
	]);
	expect(blocks[0].extensions?.list_item?.list_style).toBe('bullet');
	expect(blocks[2].extensions?.list_item?.list_style).toBe('ordered');
	expect(blocks[2].extensions?.list_item?.ordinal).toBe(1);
	expect(blocks[3].extensions?.list_item?.ordinal).toBe(2);
});
