import { beforeEach, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { invoke } from '@tauri-apps/api/core';
import ListImport from '@/components/Bookmarks/ListImport.svelte';
import { bookmarksStore } from '@/stores/bookmarks.svelte.js';
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('@/stores/bookmarks.svelte.js', () => ({
	bookmarksStore: { lists: ['Chapter'], refresh: vi.fn(), importLists: vi.fn() },
}));
const candidate = {
	id: `1:${'a'.repeat(64)}`,
	simplified: '行',
	traditional: '行',
	pinyin: { marks: 'háng' },
	english: [{ gloss: { value: 'line' } }],
};
const row = {
	line: 2,
	original: '行',
	category: 'Chapter',
	headword: '行',
	pronunciation: '',
	definition: '',
	candidates: [candidate],
	selected: null,
	reason: 'Choose an entry.',
};
beforeEach(() => vi.resetAllMocks());
it('requires a choice, shares it across categories, and reserves fresh names', async () => {
	vi.mocked(invoke).mockResolvedValue({
		format: 'pleco',
		preview: {
			source_format: 'text',
			file_name: 'Words.txt',
			rows: [row, { ...row, line: 4, category: 'Other' }],
		},
	});
	const onimported = vi.fn();
	render(ListImport, { visible: true, onclose: vi.fn(), onsyng: vi.fn(), onimported });
	await fireEvent.click(screen.getByText('Choose file'));
	await screen.findByText('Review word 1 of 1');
	expect(
		(screen.getByRole('button', { name: /^Import \d+ lists?$/ }) as HTMLButtonElement).disabled
	).toBe(true);
	await fireEvent.click(screen.getAllByRole('radio')[0]);
	await fireEvent.click(screen.getByRole('button', { name: /^Import \d+ lists?$/ }));
	await waitFor(() => expect(onimported).toHaveBeenCalledWith('Chapter 2'));
	expect(vi.mocked(bookmarksStore.importLists).mock.calls[0][0]).toEqual([
		{ id: expect.any(String), name: 'Chapter 2', lexicalIds: [candidate.id] },
		{ id: expect.any(String), name: 'Other', lexicalIds: [candidate.id] },
	]);
});
it('cancels the shared picker before any persistence', async () => {
	vi.mocked(invoke).mockResolvedValue(null);
	const onsyng = vi.fn();
	render(ListImport, { visible: true, onclose: vi.fn(), onsyng, onimported: vi.fn() });
	await fireEvent.click(screen.getByText('Choose file'));
	await waitFor(() => expect(invoke).toHaveBeenCalledWith('prepare_list_import'));
	expect(onsyng).not.toHaveBeenCalled();
	expect(bookmarksStore.importLists).not.toHaveBeenCalled();
});
it('previews a detected Syng archive and imports it without another picker', async () => {
	const archive = {
		meta: { version: 'V4', name: 'Saved list' },
		entries: [{ lexical_id: candidate.id, notes: 'note' }],
	};
	vi.mocked(invoke).mockResolvedValue({ format: 'syng', archive });
	const onsyng = vi.fn().mockResolvedValue(true);
	const onclose = vi.fn();
	render(ListImport, { visible: true, onclose, onsyng, onimported: vi.fn() });
	await fireEvent.click(screen.getByText('Choose file'));
	await screen.findByText('Syng list: Saved list');
	expect(onsyng).not.toHaveBeenCalled();
	await fireEvent.click(screen.getByText('Import list'));
	await waitFor(() => expect(onclose).toHaveBeenCalledOnce());
	expect(onsyng).toHaveBeenCalledWith(archive);
	expect(invoke).toHaveBeenCalledTimes(1);
});
it('keeps file errors visible and allows choosing another file', async () => {
	vi.mocked(invoke)
		.mockRejectedValueOnce('This XML format is not supported.')
		.mockResolvedValueOnce(null);
	render(ListImport, { visible: true, onclose: vi.fn(), onsyng: vi.fn(), onimported: vi.fn() });
	await fireEvent.click(screen.getByText('Choose file'));
	expect((await screen.findByRole('alert')).textContent).toContain(
		'This XML format is not supported.'
	);
	await fireEvent.click(screen.getByText('Choose file'));
	await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
});
it('retries failed writes using the original destination IDs', async () => {
	vi.mocked(invoke).mockResolvedValue({
		format: 'pleco',
		preview: {
			source_format: 'text',
			file_name: 'Words.txt',
			rows: [{ ...row, selected: candidate.id }],
		},
	});
	vi.mocked(bookmarksStore.importLists)
		.mockRejectedValueOnce(new Error('disk full'))
		.mockResolvedValueOnce(undefined);
	render(ListImport, { visible: true, onclose: vi.fn(), onsyng: vi.fn(), onimported: vi.fn() });
	await fireEvent.click(screen.getByText('Choose file'));
	await fireEvent.click(await screen.findByRole('button', { name: /^Import \d+ lists?$/ }));
	await fireEvent.click(await screen.findByText('Retry'));
	await waitFor(() => expect(bookmarksStore.importLists).toHaveBeenCalledTimes(2));
	expect(vi.mocked(bookmarksStore.importLists).mock.calls[0][0]).toEqual(
		vi.mocked(bookmarksStore.importLists).mock.calls[1][0]
	);
});

it('reports unmatched source records without creating an empty list', async () => {
	vi.mocked(invoke).mockResolvedValue({
		format: 'pleco',
		preview: {
			source_format: 'text',
			file_name: 'Words.txt',
			rows: [{ ...row, candidates: [], reason: 'No exact dictionary entry.' }],
		},
	});
	render(ListImport, { visible: true, onclose: vi.fn(), onsyng: vi.fn(), onimported: vi.fn() });
	await fireEvent.click(screen.getByText('Choose file'));
	await fireEvent.click(await screen.findByText('Save report'));
	expect(invoke).toHaveBeenLastCalledWith('save_pleco_report', {
		report: expect.stringContaining('Line 2 — Chapter\n行\nNo exact dictionary entry.'),
	});
	expect(bookmarksStore.importLists).not.toHaveBeenCalled();
});
