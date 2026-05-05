import { expect, it } from 'vitest';
import { ensureReaderDocumentForRendering } from '@/utils/readerDocumentCanonical.js';
import type { ReaderDocument } from '@/types/reader.js';

function buildDocument(): ReaderDocument {
	return {
		_id: 'reader-legacy',
		title: 'Legacy',
		file_name: 'legacy.txt',
		source_type: 'plain_text',
		mime_type: 'text/plain',
		extractor_version: 1,
		text: 'This text used to be upgraded into blocks.',
		blocks: [],
		imported_at: '2026-01-01T00:00:00.000Z',
		updated_at: '2026-01-01T00:00:00.000Z',
		reading_order: [{ href: 'text', type: 'text/plain', title: 'Legacy' }],
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

it('does not upgrade legacy text-only documents into blocks', () => {
	const document = ensureReaderDocumentForRendering(buildDocument());

	expect(document.canonical_schema_version).toBe(1);
	expect(document.blocks).toEqual([]);
});
