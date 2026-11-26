import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { invoke } from '@tauri-apps/api/core';
import ListImport from '@/components/Bookmarks/ListImport.svelte';
import { bookmarksStore } from '@/stores/bookmarks.svelte.js';
import type { DragDropEvent } from '@tauri-apps/api/webview';
const nativePlatform = vi.hoisted(() => ({ windows: false }));
vi.mock('@/utils/device.js', () => ({
	isMobile: () => false,
	isWindows: () => nativePlatform.windows,
}));
const drops = vi.hoisted(() => ({ listen: vi.fn(), stop: vi.fn() }));
vi.mock('@tauri-apps/api/webview', () => ({
	getCurrentWebview: () => ({ onDragDropEvent: drops.listen }),
}));
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
beforeEach(() => {
	vi.resetAllMocks();
	nativePlatform.windows = false;
	drops.listen.mockResolvedValue(drops.stop);
});
afterEach(() => vi.restoreAllMocks());

it.each(['windows', 'macos', 'linux'])(
	'accepts one file using %s native coordinates and ignores duplicate drops while reading',
	async (platform) => {
		nativePlatform.windows = platform === 'windows';
		const coordinateScale = nativePlatform.windows ? 2 : 1;
		const position = { x: 450 * coordinateScale, y: 250 * coordinateScale };
		let finishReading!: (value: null) => void;
		vi.mocked(invoke).mockImplementation(
			() =>
				new Promise((resolve) => {
					finishReading = resolve;
				})
		);
		render(ListImport, {
			visible: true,
			onclose: vi.fn(),
			onsyng: vi.fn(),
			onimported: vi.fn(),
		});
		const button = screen.getByRole('button', { name: 'Choose file' });
		vi.spyOn(button, 'getBoundingClientRect').mockReturnValue(new DOMRect(400, 200, 100, 100));
		vi.spyOn(window, 'devicePixelRatio', 'get').mockReturnValue(2);
		await waitFor(() => expect(drops.listen).toHaveBeenCalledOnce());
		const dispatch = (payload: object) => drops.listen.mock.calls[0][0]({ payload });
		dispatch({
			type: 'drop',
			paths: ['/tmp/outside.xml'],
			position: { x: 600 * coordinateScale, y: 250 * coordinateScale },
		});
		expect(invoke).not.toHaveBeenCalled();
		dispatch({ type: 'enter', paths: ['/tmp/words.xml'], position });
		await waitFor(() => expect(button.classList.contains('drop-area--active')).toBe(true));
		dispatch({ type: 'leave' });
		await waitFor(() => expect(button.classList.contains('drop-area--active')).toBe(false));
		dispatch({ type: 'drop', paths: ['/tmp/one.xml', '/tmp/two.xml'], position });
		expect((await screen.findByRole('alert')).textContent).toContain('Drop one list file');
		expect(invoke).not.toHaveBeenCalled();
		dispatch({ type: 'drop', paths: ['/tmp/words.xml'], position });
		dispatch({ type: 'drop', paths: ['/tmp/duplicate.xml'], position });
		expect(invoke).toHaveBeenCalledExactlyOnceWith('prepare_list_import', {
			path: '/tmp/words.xml',
		});
		expect(bookmarksStore.importLists).not.toHaveBeenCalled();
		finishReading(null);
		await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));
	}
);

it('releases a late drop subscription after closing and ignores stale events', async () => {
	let finishListening!: (stop: () => void) => void;
	drops.listen.mockImplementation(
		() =>
			new Promise((resolve) => {
				finishListening = resolve;
			})
	);
	const { unmount } = render(ListImport, {
		visible: true,
		onclose: vi.fn(),
		onsyng: vi.fn(),
		onimported: vi.fn(),
	});
	await waitFor(() => expect(drops.listen).toHaveBeenCalledOnce());
	const listener = drops.listen.mock.calls[0][0] as (event: { payload: DragDropEvent }) => void;
	unmount();
	finishListening(drops.stop);
	await waitFor(() => expect(drops.stop).toHaveBeenCalledOnce());
	listener({ payload: { type: 'leave' } });
	expect(invoke).not.toHaveBeenCalled();
});

it('keeps the picker usable when native drag events are unavailable', async () => {
	drops.listen.mockRejectedValue(new Error('event unavailable'));
	vi.mocked(invoke).mockResolvedValue(null);
	render(ListImport, { visible: true, onclose: vi.fn(), onsyng: vi.fn(), onimported: vi.fn() });
	expect((await screen.findByRole('alert')).textContent).toContain('Use Choose file instead');
	await fireEvent.click(screen.getByRole('button', { name: 'Choose file' }));
	expect(invoke).toHaveBeenCalledExactlyOnceWith('prepare_list_import');
});
it.each(['text', 'xml'])(
	'requires a choice, shares it across %s categories, and reserves fresh names',
	async (sourceFormat) => {
		vi.mocked(invoke).mockResolvedValue({
			format: 'pleco',
			preview: {
				source_format: sourceFormat,
				file_name: 'Words.txt',
				rows: [row, { ...row, line: 4, category: 'Other' }],
			},
		});
		const onimported = vi.fn();
		render(ListImport, { visible: true, onclose: vi.fn(), onsyng: vi.fn(), onimported });
		await fireEvent.click(screen.getByText('Choose file'));
		await screen.findByText('Review word 1 of 1');
		expect(
			(screen.getByRole('button', { name: /^Import \d+ lists?$/ }) as HTMLButtonElement)
				.disabled
		).toBe(true);
		await fireEvent.click(screen.getAllByRole('radio')[0]);
		await fireEvent.click(screen.getByRole('button', { name: /^Import \d+ lists?$/ }));
		await waitFor(() => expect(onimported).toHaveBeenCalledWith('Chapter 2'));
		expect(vi.mocked(bookmarksStore.importLists).mock.calls[0][0]).toEqual([
			{ id: expect.any(String), name: 'Chapter 2', lexicalIds: [candidate.id] },
			{ id: expect.any(String), name: 'Other', lexicalIds: [candidate.id] },
		]);
	}
);

it('adds the chosen HSK level directly and retries saving with the same destination and memberships', async () => {
	const standard = 'hsk_exam_syllabus_2025';
	vi.mocked(invoke).mockImplementation(async (command) => {
		if (command === 'get_hsk_lists') {
			return [
				{ id: 'one', standard, level: 'One', word_count: 2 },
				{ id: 'two', standard, level: 'Two', word_count: 1 },
			];
		}
		if (command === 'prepare_hsk_list') {
			return [candidate.id];
		}
		throw new Error('Unexpected command');
	});
	vi.mocked(bookmarksStore.importLists)
		.mockRejectedValueOnce(new Error('disk full'))
		.mockResolvedValueOnce(undefined);
	const onimported = vi.fn();
	render(ListImport, { visible: true, onclose: vi.fn(), onsyng: vi.fn(), onimported });
	await fireEvent.click(screen.getByRole('button', { name: 'Browse lists' }));
	await fireEvent.change(await screen.findByLabelText('Level'), { target: { value: 'Two' } });
	await screen.findByText(/1 word in this level\./);
	expect(bookmarksStore.importLists).not.toHaveBeenCalled();
	await fireEvent.click(screen.getByRole('button', { name: 'Add List' }));
	await screen.findByRole('button', { name: 'Retry' });
	expect(invoke).toHaveBeenLastCalledWith('prepare_hsk_list', { id: 'two' });
	expect((screen.getByLabelText('Level') as HTMLSelectElement).disabled).toBe(true);
	expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
	await fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));
	await waitFor(() =>
		expect(onimported).toHaveBeenCalledWith('HSK Exam Syllabus 2025 — Level 2')
	);
	const attempts = vi.mocked(bookmarksStore.importLists).mock.calls;
	expect(attempts[0][0]).toEqual([
		{
			id: expect.any(String),
			name: 'HSK Exam Syllabus 2025 — Level 2',
			lexicalIds: [candidate.id],
		},
	]);
	expect(attempts[1][0]).toEqual(attempts[0][0]);
});

it('keeps file import available after a built-in catalog failure', async () => {
	vi.mocked(invoke)
		.mockRejectedValueOnce(new Error('missing catalog'))
		.mockResolvedValueOnce(null);
	render(ListImport, { visible: true, onclose: vi.fn(), onsyng: vi.fn(), onimported: vi.fn() });
	await fireEvent.click(screen.getByRole('button', { name: 'Browse lists' }));
	expect((await screen.findByRole('alert')).textContent).toContain(
		'Could not load the pre-built lists'
	);
	await fireEvent.click(screen.getByRole('button', { name: 'Choose file' }));
	expect(invoke).toHaveBeenLastCalledWith('prepare_list_import');
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
