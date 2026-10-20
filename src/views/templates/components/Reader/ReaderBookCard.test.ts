import { render } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import ReaderBookCard from '@/components/Reader/ReaderBookCard.svelte';
import type { ReaderDocument } from '@/types/reader.js';
import { createPlainTextReaderImportPayload } from '@/utils/readerDocument.js';

const readerDocument: ReaderDocument = {
	...createPlainTextReaderImportPayload('Story', '你好世界'),
	_id: 'reader-card',
	imported_at: '2026-01-01T00:00:00.000Z',
	updated_at: '2026-01-01T00:00:00.000Z',
	reading_order: [],
	progress: {
		resource_href: 'text',
		position: 1,
		total_progression: 0.25,
		page_index: 0,
		text_position: { start: 1, end: 1 },
		text_quote: { exact: '', prefix: '', suffix: '' },
		updated_at: '2026-01-01T00:00:00.000Z',
	},
};

it('opens the native card button with Enter or Space, without handling other keys', async () => {
	const user = userEvent.setup();
	const onclick = vi.fn();
	const { getByRole } = render(ReaderBookCard, { document: readerDocument, onclick });
	const card = getByRole('button', { name: 'Open Story' });
	expect(card.tagName).toBe('BUTTON');
	expect(card.hasAttribute('aria-pressed')).toBe(false);
	expect(document.getElementById(card.getAttribute('aria-describedby') ?? '')?.textContent).toBe(
		'25%'
	);
	await user.tab();
	await user.keyboard('x{ArrowRight}');
	expect(onclick).not.toHaveBeenCalled();
	await user.keyboard('{Enter} ');
	expect(onclick).toHaveBeenCalledTimes(2);
});

it('exposes selection and gives editing a separate button that does not select the card', async () => {
	const user = userEvent.setup();
	const onclick = vi.fn();
	const onedit = vi.fn();
	const { getByRole, rerender } = render(ReaderBookCard, {
		document: readerDocument,
		editing: true,
		selected: false,
		onclick,
		onedit,
	});
	const card = getByRole('button', { name: 'Select Story', pressed: false });
	const edit = getByRole('button', { name: 'Edit Story' });
	expect(card.contains(edit)).toBe(false);
	await user.tab();
	expect(document.activeElement).toBe(card);
	await user.tab();
	expect(document.activeElement).toBe(edit);
	await user.keyboard('{Enter}');
	expect(onedit).toHaveBeenCalledOnce();
	expect(onclick).not.toHaveBeenCalled();
	await rerender({ selected: true });
	expect(getByRole('button', { name: 'Select Story', pressed: true })).toBe(card);
});
