import { beforeEach, vi } from 'vitest';

let readerDocumentsStore;
let setReaderDocumentManagerForTest;

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
	updateProgress: vi.fn(() =>
		Promise.resolve({ ...document, progress: { ...document.progress, page_index: 1 } })
	),
	updateMetadata: vi.fn(() =>
		Promise.resolve({ ...document, title: 'Renamed', color: '#91d7b4' })
	),
	getDocument: vi.fn(() => Promise.resolve(document)),
	getSourceData: vi.fn(() => Promise.resolve(new ArrayBuffer(0))),
	...overrides,
});

beforeEach(async () => {
	vi.resetModules();
	({ setReaderDocumentManagerForTest } = await import('@/utils/appServices.js'));
	({ readerDocumentsStore } = await import('@/stores/readerDocuments.svelte.js'));
});

it('refresh() should populate documents from the manager', async () => {
	const manager = buildManager();
	setReaderDocumentManagerForTest(manager);

	await readerDocumentsStore.refresh();

	expect(manager.getDocuments).toHaveBeenCalled();
	expect(readerDocumentsStore.documents).toEqual([document]);
});

it('importDocument() should save through the manager and prepend the document', async () => {
	const manager = buildManager({ getDocuments: vi.fn(() => Promise.resolve([])) });
	setReaderDocumentManagerForTest(manager);
	await readerDocumentsStore.refresh();

	const result = await readerDocumentsStore.importDocument({
		title: 'Story',
		file_name: 'story.txt',
		source_type: 'plain_text',
		mime_type: 'text/plain',
		extractor_version: 1,
		text: '你好',
		blocks: [],
	});

	expect(manager.createDocument).toHaveBeenCalled();
	expect(result).toEqual(document);
	expect(readerDocumentsStore.documents).toEqual([document]);
});

it('deleteDocument() should remove a document from the cache', async () => {
	const manager = buildManager();
	setReaderDocumentManagerForTest(manager);
	await readerDocumentsStore.refresh();

	await readerDocumentsStore.deleteDocument('reader-1');

	expect(manager.deleteDocument).toHaveBeenCalledWith('reader-1');
	expect(readerDocumentsStore.documents).toEqual([]);
});

it('updateMetadata() should update the cached document', async () => {
	const manager = buildManager();
	setReaderDocumentManagerForTest(manager);
	await readerDocumentsStore.refresh();

	const result = await readerDocumentsStore.updateMetadata('reader-1', {
		title: 'Renamed',
		color: '#91d7b4',
	});

	expect(manager.updateMetadata).toHaveBeenCalledWith('reader-1', {
		title: 'Renamed',
		color: '#91d7b4',
	});
	expect(result.title).toBe('Renamed');
	expect(readerDocumentsStore.documents[0].title).toBe('Renamed');
});
