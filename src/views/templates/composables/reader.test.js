import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { telemetry } from '@/utils';

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
});
afterEach(() => vi.useRealTimers());

it('navigates to an imported document after saving it', async () => {
	const { manager, readerDocumentsStore, readerRoute } = await setup({
		getDocuments: vi.fn(() => Promise.resolve([])),
	});
	await readerDocumentsStore.refresh();

	await readerRoute.importReaderPayload(
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
