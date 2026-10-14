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
