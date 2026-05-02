import { expect, it } from 'vitest';
import { openReaderPublication } from '@/reader/publication/index.js';
import { textPublicationAdapter } from '@/reader/publication/textAdapter.js';
import { webpagePublicationAdapter } from '@/reader/publication/webpageAdapter.js';

it('opens plain text as a reflowable publication with dictionary support', async () => {
	const publication = await openReaderPublication(
		{
			id: 'reader-text',
			title: 'Text Story',
			text: '你好\n世界',
			mimeType: 'text/plain',
		},
		[textPublicationAdapter]
	);

	expect(publication.format).toBe('text');
	expect(publication.readingOrder[0].href).toBe('text/main.txt');
	expect(publication.resources[0].text).toBe('你好\n世界');
	expect(publication.capabilities.supportsDictionaryLookup).toBe(true);
});

it('extracts and sanitizes webpage content as reflowable HTML', async () => {
	const publication = await openReaderPublication(
		{
			id: 'reader-web',
			title: 'Fallback Title',
			html: '<article><h1>Article</h1><p>你好世界</p><script>alert("x")</script></article>',
			mimeType: 'text/html',
		},
		[webpagePublicationAdapter]
	);

	expect(publication.format).toBe('webpage');
	expect(publication.resources[0].html).toContain('你好世界');
	expect(publication.resources[0].html).not.toContain('<script');
	expect(publication.capabilities.supportsThemes).toBe(true);
});
