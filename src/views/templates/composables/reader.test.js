import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { handleError, telemetry } from '@/utils';
import { invoke } from '@tauri-apps/api/core';
import { ask } from '@tauri-apps/plugin-dialog';
import { LARGE_HTML_IMPORT_ERROR_CODE } from '@/utils/readerDocument.js';

const network = vi.hoisted(() => ({ isOffline: false }));

vi.mock('@/utils/networkStatus.svelte.js', () => ({ networkStatus: network }));

vi.mock('@tauri-apps/api/core', () => ({
	invoke: vi.fn(() => Promise.resolve([])),
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
	ask: vi.fn(() => Promise.resolve(true)),
}));

vi.mock('@/utils', () => ({
	handleError: vi.fn(),
	telemetry: {
		trackEvent: vi.fn(() => Promise.resolve()),
		trackError: vi.fn(() => Promise.resolve()),
	},
}));

const document = {
	_id: 'reader-1',
	title: 'Story',
	file_name: 'story.txt',
	source_type: 'plain_text',
	mime_type: 'text/plain',
	extractor_version: 1,
	color: '#ffffff',
	text: '你好',
	blocks: [],
	imported_at: '2026-01-01T00:00:00.000Z',
	updated_at: '2026-01-01T00:00:00.000Z',
	reading_order: [],
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

const buildManager = (overrides = {}) => ({
	waitForInit: vi.fn(() => Promise.resolve()),
	getDocuments: vi.fn(() => Promise.resolve([document])),
	createDocument: vi.fn(() => Promise.resolve(document)),
	deleteDocument: vi.fn(() => Promise.resolve()),
	updateProgress: vi.fn(() => Promise.resolve(document)),
	updateMetadata: vi.fn(() => Promise.resolve(document)),
	getDocument: vi.fn(() => Promise.resolve(document)),
	getSourceData: vi.fn(() => Promise.resolve(new ArrayBuffer(0))),
	getSourceHtml: vi.fn(() => Promise.resolve(undefined)),
	...overrides,
});

async function setup(overrides = {}) {
	vi.resetModules();
	window.location.hash = '#/read';

	const manager = buildManager(overrides);
	const { setReaderDocumentManagerForTest } = await import('@/utils/appServices.js');
	const { readerDocumentsStore } = await import('@/stores/readerDocuments.svelte.js');
	const { readerRoute } = await import('@/composables/reader.svelte.js');
	setReaderDocumentManagerForTest(manager);

	return { manager, readerDocumentsStore, readerRoute };
}

beforeEach(() => {
	vi.stubGlobal('alert', vi.fn());
	vi.mocked(telemetry.trackEvent).mockClear();
	vi.mocked(handleError).mockClear();
	vi.mocked(invoke).mockReset().mockResolvedValue([]);
	vi.mocked(ask).mockReset().mockResolvedValue(true);
	network.isOffline = false;
});
afterEach(() => vi.useRealTimers());

it('navigates to an imported document after saving it', async () => {
	const { manager, readerDocumentsStore, readerRoute } = await setup({
		getDocuments: vi.fn(() => Promise.resolve([])),
	});
	await readerDocumentsStore.refresh();

	const result = await readerRoute.importReaderPayload(
		{
			title: 'Story',
			file_name: 'story.txt',
			source_type: 'plain_text',
			mime_type: 'text/plain',
			extractor_version: 1,
			text: '你好',
			blocks: [],
		},
		'Story',
		'#ffffff'
	);

	expect(manager.createDocument).toHaveBeenCalled();
	expect(result).toEqual({ status: 'success' });
	expect(readerRoute.importing).toBe(false);
	expect(readerRoute.activeDocument).toBeUndefined();
	expect(window.location.hash).toBe('#/read/document/reader-1');
	await readerRoute.openDocumentById(document._id);
	expect(readerRoute.activeDocument?._id).toBe(document._id);
	expect(
		vi
			.mocked(telemetry.trackEvent)
			.mock.calls.filter(([name]) => name === 'reader.document_opened')
	).toHaveLength(1);
});

it('returns a recoverable save error, logs silently, and allows the same prepared payload to retry', async () => {
	const failure = new Error('Storage unavailable');
	const createDocument = vi.fn().mockRejectedValueOnce(failure).mockResolvedValueOnce(document);
	const { readerRoute } = await setup({ createDocument });

	const result = await readerRoute.importReaderPayload(document, 'My title', '#ffffff');
	expect(result).toEqual({
		status: 'error',
		message: 'There was an error importing the reader document.',
	});
	expect(handleError).toHaveBeenCalledWith(result.message, failure, { silent: true });
	expect(telemetry.trackEvent).toHaveBeenCalledWith('reader.document_import_failed', {
		source_type: 'plain_text',
		stage: 'save',
		error_name: 'Error',
	});
	expect(readerRoute.importing).toBe(false);
	expect(window.location.hash).toBe('#/read');
	expect(await readerRoute.importReaderPayload(document, 'My title', '#ffffff')).toEqual({
		status: 'success',
	});
	expect(createDocument.mock.calls[1]).toEqual(createDocument.mock.calls[0]);
});

it('returns clipboard preparation errors and releases the import busy state', async () => {
	const { readerRoute, manager } = await setup();
	const failure = new Error('Could not process text');
	vi.mocked(invoke).mockRejectedValueOnce(failure);
	const pending = readerRoute.importPlainTextDocument('Title', 'Keep my pasted text', '#ffffff');
	expect(readerRoute.importing).toBe(true);
	const result = await pending;
	expect(result.status).toBe('error');
	expect(handleError).toHaveBeenCalledWith(result.message, failure, { silent: true });
	expect(readerRoute.importing).toBe(false);
	expect(manager.createDocument).not.toHaveBeenCalled();
});

it('returns clipboard storage failures without incorrectly reporting a second preparation failure', async () => {
	const { readerRoute } = await setup({
		createDocument: vi.fn().mockRejectedValue(new Error('Storage unavailable')),
	});
	vi.mocked(invoke).mockResolvedValueOnce(document);
	const result = await readerRoute.importPlainTextDocument(
		'Title',
		'Keep my pasted text',
		'#ffffff'
	);
	expect(result.status).toBe('error');
	expect(handleError).toHaveBeenCalledTimes(1);
	expect(
		vi
			.mocked(telemetry.trackEvent)
			.mock.calls.filter(([name]) => name === 'reader.document_import_failed')
	).toEqual([
		[
			'reader.document_import_failed',
			{ source_type: 'plain_text', stage: 'save', error_name: 'Error' },
		],
	]);
	expect(readerRoute.importing).toBe(false);
});

it('returns cancelled when a large webpage is declined without reporting it as an error', async () => {
	const { readerRoute, manager } = await setup();
	vi.mocked(invoke).mockRejectedValueOnce(
		JSON.stringify({ code: LARGE_HTML_IMPORT_ERROR_CODE, receivedBytes: 2097152 })
	);
	vi.mocked(ask).mockResolvedValueOnce(false);
	const result = await readerRoute.importWebpageDocument(
		'Title',
		'https://example.com',
		'#ffffff'
	);
	expect(result).toEqual({ status: 'cancelled' });
	expect(readerRoute.importing).toBe(false);
	expect(handleError).not.toHaveBeenCalled();
	expect(manager.createDocument).not.toHaveBeenCalled();
	expect(telemetry.trackEvent).not.toHaveBeenCalledWith(
		'reader.document_import_failed',
		expect.anything()
	);
});

it('explains offline webpage import while allowing a prepared preview to save offline', async () => {
	const { readerRoute, manager } = await setup();
	network.isOffline = true;
	const unavailable = await readerRoute.importWebpageDocument(
		'Title',
		'https://example.com',
		'#ffffff'
	);
	expect(unavailable).toEqual({
		status: 'error',
		message: 'You are offline. Connect to the internet to import a webpage.',
	});
	expect(readerRoute.importing).toBe(false);
	expect(manager.createDocument).not.toHaveBeenCalled();
	const saved = await readerRoute.importWebpageDocument(
		'Title',
		'https://example.com',
		'#ffffff',
		document
	);
	expect(saved).toEqual({ status: 'success' });
	expect(manager.createDocument).toHaveBeenCalledTimes(1);
	expect(invoke).not.toHaveBeenCalled();
});

it('aggregates only actual page turns and flushes on time, background and exit', async () => {
	vi.useFakeTimers();
	const text = '你好'.repeat(4000);
	const longDocument = {
		...document,
		text,
		blocks: [
			{ id: 'paragraph', kind: 'paragraph', text, start_offset: 0, end_offset: text.length },
		],
	};
	const { readerRoute, manager } = await setup({
		updateProgress: vi.fn(() => Promise.resolve(longDocument)),
	});
	const unmount = readerRoute.mountTelemetry();
	await readerRoute.openDocument(longDocument);
	expect(readerRoute.pageCount).toBeGreaterThan(2);
	await readerRoute.goToPage(0);
	await readerRoute.nextPage();
	await readerRoute.nextPage();
	await readerRoute.previousPage();
	expect(manager.updateProgress).toHaveBeenCalledTimes(3);
	expect(telemetry.trackEvent).not.toHaveBeenCalledWith(
		'reader.position_saved',
		expect.anything()
	);
	expect(telemetry.trackEvent).not.toHaveBeenCalledWith(
		'reader.reading_activity',
		expect.anything()
	);
	await vi.advanceTimersByTimeAsync(30_000);
	expect(telemetry.trackEvent).toHaveBeenLastCalledWith('reader.reading_activity', {
		next_count: 2,
		previous_count: 1,
	});
	await readerRoute.nextPage();
	window.dispatchEvent(new Event('pagehide'));
	expect(telemetry.trackEvent).toHaveBeenLastCalledWith('reader.reading_activity', {
		next_count: 1,
		previous_count: 0,
	});
	await readerRoute.previousPage();
	unmount();
	expect(telemetry.trackEvent).toHaveBeenLastCalledWith('reader.reading_activity', {
		next_count: 0,
		previous_count: 1,
	});
	await vi.advanceTimersByTimeAsync(30_000);
	expect(
		vi
			.mocked(telemetry.trackEvent)
			.mock.calls.filter(([name]) => name === 'reader.reading_activity')
	).toHaveLength(3);
});

it('returns to the library when a routed document cannot be loaded', async () => {
	const { manager, readerDocumentsStore, readerRoute } = await setup({
		getDocument: vi.fn(() => Promise.resolve(undefined)),
	});
	await readerDocumentsStore.refresh();
	await readerRoute.openDocument(document);

	window.location.hash = '#/read/document/missing';
	await readerRoute.openDocumentById('missing');

	expect(manager.getDocument).toHaveBeenCalledWith('missing');
	expect(readerRoute.activeDocument).toBeUndefined();
	expect(window.location.hash).toBe('#/read');
});

it('discards pronunciation responses from a document that has been replaced', async () => {
	const { readerRoute } = await setup();
	const { readerSettingsStore } = await import('@/stores/readerSettings.svelte.js');
	readerSettingsStore.setShowPinyin(true);
	let finishOld;
	vi.mocked(invoke).mockImplementationOnce(
		() =>
			new Promise((resolve) => {
				finishOld = resolve;
			})
	);
	const oldOpening = readerRoute.openDocument({
		...document,
		blocks: [{ id: 'shared', kind: 'paragraph', text: '你好' }],
	});
	vi.mocked(invoke).mockResolvedValue([
		{
			text: '学习',
			start: 0,
			end: 2,
			pinyin: { marks: 'xué xí', numbers: 'xue2xi2', tones: [2, 2] },
		},
	]);
	await readerRoute.openDocument({
		...document,
		_id: 'reader-2',
		text: '学习',
		blocks: [{ id: 'shared', kind: 'paragraph', text: '学习' }],
	});
	finishOld([
		{
			text: '你好',
			start: 0,
			end: 2,
			pinyin: { marks: 'nǐ hǎo', numbers: 'ni3hao3', tones: [3, 3] },
		},
	]);
	await oldOpening;
	expect(readerRoute.activeDocument._id).toBe('reader-2');
	expect(readerRoute.getBlockSegments(readerRoute.currentPage.blocks[0])).toEqual([
		expect.objectContaining({ text: '学习', annotation: 'xué xí' }),
	]);
});

it('ignores pending pronunciation when switched off and enriches again when enabled', async () => {
	const { readerRoute } = await setup();
	const { readerSettingsStore } = await import('@/stores/readerSettings.svelte.js');
	readerSettingsStore.setShowPinyin(true);
	let finishEnrichment;
	vi.mocked(invoke).mockImplementationOnce(
		() =>
			new Promise((resolve) => {
				finishEnrichment = resolve;
			})
	);
	const opening = readerRoute.openDocument({
		...document,
		blocks: [{ id: 'b', kind: 'paragraph', text: '你好' }],
	});
	readerSettingsStore.setShowPinyin(false);
	vi.mocked(invoke).mockResolvedValue([{ text: '你好', start: 0, end: 2 }]);
	await readerRoute.refreshPinyin();
	const annotated = [
		{
			text: '你好',
			start: 0,
			end: 2,
			pinyin: { marks: 'nǐ hǎo', numbers: 'ni3hao3', tones: [3, 3] },
		},
	];
	finishEnrichment(annotated);
	await opening;
	expect(
		readerRoute
			.getBlockSegments(readerRoute.currentPage.blocks[0])
			.some((segment) => segment.annotation)
	).toBe(false);
	readerSettingsStore.setShowPinyin(true);
	vi.mocked(invoke).mockResolvedValue(annotated);
	await readerRoute.refreshPinyin();
	expect(invoke).toHaveBeenCalledTimes(3);
	expect(readerRoute.getBlockSegments(readerRoute.currentPage.blocks[0])[0].annotation).toBe(
		'nǐ hǎo'
	);
});

it('retains native imported ruby flow when pinyin is off', async () => {
	const { readerRoute } = await setup();
	const { readerSettingsStore } = await import('@/stores/readerSettings.svelte.js');
	readerSettingsStore.setShowPinyin(false);
	await readerRoute.openDocument({
		...document,
		text: '学习中文',
		blocks: [
			{
				id: 'b',
				kind: 'paragraph',
				text: '学习中文',
				spans: [{ start: 0, end: 4, style: 'ruby', annotation: 'xué xí zhōng wén' }],
				extensions: { block_style: { text_indent: '2em' } },
			},
		],
	});
	await readerRoute.setPageLayout({
		contentWidth: 400,
		contentHeight: 600,
		fontSize: 20,
		lineHeight: 40,
		blockGap: 28,
		headingLineHeight: 40,
		headingGap: 28,
	});
	expect(readerRoute.currentPage.blocks[0].textLines).toBeUndefined();
});

it('reserves empty table cells and empty rows in pinyin page-turn snapshots', async () => {
	const { readerRoute } = await setup();
	const { readerSettingsStore } = await import('@/stores/readerSettings.svelte.js');
	readerSettingsStore.setShowPinyin(true);
	await readerRoute.openDocument({
		...document,
		text: '',
		blocks: [
			{
				id: 'table',
				kind: 'table',
				text: '',
				participates_in_linear_text: false,
				extensions: {
					table: {
						rows: [
							{ cells: [{ text: '' }, { text: '学习' }] },
							{ cells: [{ text: '' }, { text: '' }] },
							{ cells: [{ text: '中文' }, { text: '' }] },
						],
					},
				},
			},
		],
	});
	await readerRoute.setPageLayout({
		contentWidth: 400,
		contentHeight: 600,
		fontSize: 20,
		lineHeight: 40,
		blockGap: 28,
		headingLineHeight: 40,
		headingGap: 28,
	});
	const snapshot = readerRoute.currentPage.blocks[0].tableSnapshot;
	expect(snapshot.cells).toHaveLength(6);
	expect(snapshot.cells[1].x - snapshot.cells[0].x).toBeCloseTo(200);
	const rowHeight = snapshot.cells[2].y - snapshot.cells[0].y;
	expect(rowHeight).toBeGreaterThan(0);
	const emptyRowHeight = 2 * 19 * 0.35 + 1;
	expect(snapshot.cells[4].y - snapshot.cells[2].y).toBeCloseTo(emptyRowHeight);
	expect(snapshot.height).toBeCloseTo(2 * rowHeight + emptyRowHeight);
});

it.each([false, true])(
	'prepares the requested text page after a zero-offset image (pinyin %s)',
	async (showPinyin) => {
		const { readerRoute } = await setup();
		const { readerSettingsStore } = await import('@/stores/readerSettings.svelte.js');
		readerSettingsStore.setShowPinyin(showPinyin);
		await readerRoute.setPageLayout({
			contentWidth: 100,
			contentHeight: 70,
			fontSize: 20,
			lineHeight: 40,
			blockGap: 28,
			headingLineHeight: 40,
			headingGap: 28,
		});
		await readerRoute.openDocument({
			...document,
			blocks: [
				{
					id: 'cover',
					kind: 'image',
					text: '',
					participates_in_linear_text: false,
					extensions: {
						image: {
							asset_id: 'cover',
							mime_type: 'image/png',
							width: 100,
							height: 200,
						},
					},
				},
				{ id: 'text', kind: 'paragraph', text: '你好', start_offset: 0, end_offset: 2 },
			],
		});

		expect(readerRoute.pageCount).toBe(2);
		expect(readerRoute.getPage(0).start).toBe(readerRoute.getPage(1).start);
		vi.mocked(invoke)
			.mockClear()
			.mockResolvedValue([
				{
					text: '你好',
					start: 0,
					end: 2,
					pinyin: { marks: 'nǐ hǎo', numbers: 'ni3hao3', tones: [3, 3] },
				},
			]);
		expect(await readerRoute.preparePageTurn('next')).toBe(1);
		expect(invoke).toHaveBeenCalledWith(
			'tokenize_reader_text',
			expect.objectContaining({ text: '你好' })
		);
		expect(readerRoute.pageIndex).toBe(0);
		await readerRoute.nextPage();
		expect(readerRoute.pageIndex).toBe(1);
		expect(readerRoute.currentPage.blocks[0].sourceBlockId).toBe('text');
		expect(readerRoute.getBlockSegments(readerRoute.currentPage.blocks[0])[0].token.text).toBe(
			'你好'
		);
		await readerRoute.previousPage();
		expect(readerRoute.currentPage.blocks[0].sourceBlockId).toBe('cover');
	}
);
