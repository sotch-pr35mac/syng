import { vi } from 'vitest';
import { ReaderDocumentManager } from '@/utils/readerDocumentManager.js';

const documentsByDb = {};
const attachmentsByDb = {};
const SAVED_POSITION = 5;
const SAVED_POSITION_END = 8;
const SOURCE_BYTE_ONE = 1;
const SOURCE_BYTE_TWO = 2;
const SOURCE_BYTE_THREE = 3;
const SOURCE_BYTE_NINE = 9;
const SOURCE_BYTES = [SOURCE_BYTE_ONE, SOURCE_BYTE_TWO, SOURCE_BYTE_THREE];
const SOURCE_HTML = '<html><body><p>Story</p></body></html>';
const getDocuments = (dbName) => {
	if (!documentsByDb[dbName]) {
		documentsByDb[dbName] = [];
	}
	return documentsByDb[dbName];
};
const getAttachments = (dbName) => {
	if (!attachmentsByDb[dbName]) {
		attachmentsByDb[dbName] = {};
	}
	return attachmentsByDb[dbName];
};

global.PouchDB = class {
	constructor(dbName) {
		const documents = getDocuments(dbName);
		const attachments = getAttachments(dbName);

		this.allDocs = vi.fn(() =>
			Promise.resolve({
				rows: documents.map((doc) => ({ doc })),
			})
		);
		this.put = vi.fn((newItem) => {
			const index = documents.findIndex((doc) => doc._id === newItem._id);
			const itemWithRev = {
				...newItem,
				_rev: `${index < 0 ? 1 : Number(documents[index]._rev ?? 1) + 1}`,
			};
			if (index < 0) {
				documents.push(itemWithRev);
			} else {
				documents[index] = itemWithRev;
			}
			return Promise.resolve({
				ok: true,
				id: itemWithRev._id,
				rev: itemWithRev._rev,
			});
		});
		this.get = vi.fn((id) => {
			const document = documents.find((doc) => doc._id === id);
			if (!document) {
				return Promise.reject({ status: 404 });
			}
			return Promise.resolve(document);
		});
		this.putAttachment = vi.fn((id, name, rev, data) => {
			attachments[`${id}:${name}`] = data;
			const index = documents.findIndex((doc) => doc._id === id);
			const nextRev = `${Number(rev ?? documents[index]?._rev ?? 1) + 1}`;
			if (index >= 0) {
				documents[index] = { ...documents[index], _rev: nextRev };
			}
			return Promise.resolve({ ok: true, id, rev: nextRev });
		});
		this.getAttachment = vi.fn((id, name) => {
			const attachment = attachments[`${id}:${name}`];
			if (!attachment) {
				return Promise.reject({ status: 404 });
			}
			return Promise.resolve(attachment);
		});
		this.remove = vi.fn((document) => {
			const index = documents.findIndex((doc) => doc._id === document._id);
			if (index >= 0) {
				documents.splice(index, 1);
			}
			return Promise.resolve({ ok: true });
		});
	}
};

const importPayload = {
	canonical_schema_version: 1,
	title: 'Story',
	file_name: 'story.txt',
	source_type: 'plain_text',
	mime_type: 'text/plain',
	extractor_version: 1,
	color: '#ffffff',
	text: '你好今天的天气还好。',
	blocks: [
		{
			id: 'block-0',
			kind: 'paragraph',
			text: '你好今天的天气还好。',
			start_offset: 0,
			end_offset: 10,
		},
	],
};

beforeEach(() => {
	for (const dbName of Object.keys(documentsByDb)) {
		delete documentsByDb[dbName];
	}
	for (const dbName of Object.keys(attachmentsByDb)) {
		delete attachmentsByDb[dbName];
	}
});

it('creates and lists reader documents', async () => {
	const manager = new ReaderDocumentManager('test-reader-documents');
	await manager.init();
	const document = await manager.createDocument(importPayload);

	const documents = await manager.getDocuments();
	expect(documents).toHaveLength(1);
	expect(documents[0]._id).toBe(document._id);
	expect(documents[0].title).toBe('Story');
	expect(documents[0].reading_order).toEqual([
		{ href: 'text', type: 'text/plain', title: 'Story' },
	]);
	expect(documents[0].canonical_schema_version).toBe(1);
});

it('updates document progress', async () => {
	const manager = new ReaderDocumentManager('test-reader-documents');
	await manager.init();
	const document = await manager.createDocument(importPayload);

	const updated = await manager.updateProgress(document._id, {
		resource_href: 'text',
		position: SAVED_POSITION,
		total_progression: 0.5,
		page_index: 1,
		text_position: { start: SAVED_POSITION, end: SAVED_POSITION_END },
		text_quote: { exact: '今天', prefix: '你好', suffix: '的天气' },
		updated_at: new Date().toISOString(),
	});

	expect(updated.progress.position).toBe(SAVED_POSITION);
	expect(updated.progress.page_index).toBe(1);
});

it('stores and loads binary source attachments', async () => {
	const manager = new ReaderDocumentManager('test-reader-documents');
	await manager.init();
	const sourceData = new Uint8Array(SOURCE_BYTES);
	const document = await manager.createDocument({
		...importPayload,
		title: 'PDF',
		file_name: 'story.pdf',
		source_type: 'pdf',
		mime_type: 'application/pdf',
		text: '',
		blocks: [],
		source_data: sourceData,
	});

	const loaded = await manager.getSourceData(document._id);

	expect(loaded).toBeInstanceOf(ArrayBuffer);
	expect(Array.from(new Uint8Array(loaded))).toEqual(SOURCE_BYTES);
	expect(document.reading_order).toEqual([
		{ href: 'source', type: 'application/pdf', title: 'PDF' },
	]);
});

it('stores native number-array source attachments', async () => {
	const manager = new ReaderDocumentManager('test-reader-documents');
	await manager.init();
	const document = await manager.createDocument({
		...importPayload,
		title: 'PDF',
		file_name: 'story.pdf',
		source_type: 'pdf',
		mime_type: 'application/pdf',
		text: '',
		blocks: [],
		source_data: SOURCE_BYTES,
	});

	const loaded = await manager.getSourceData(document._id);

	expect(Array.from(new Uint8Array(loaded))).toEqual(SOURCE_BYTES);
});

it('stores base64-encoded source attachments from native imports', async () => {
	const manager = new ReaderDocumentManager('test-reader-documents');
	await manager.init();
	const base64Source = btoa(String.fromCharCode(...SOURCE_BYTES));
	const document = await manager.createDocument({
		...importPayload,
		title: 'PDF',
		file_name: 'story.pdf',
		source_type: 'pdf',
		mime_type: 'application/pdf',
		text: '',
		blocks: [],
		source_data: base64Source,
	});

	const loaded = await manager.getSourceData(document._id);

	expect(Array.from(new Uint8Array(loaded))).toEqual(SOURCE_BYTES);
});

it('stores source HTML as an attachment instead of inline document data', async () => {
	const manager = new ReaderDocumentManager('test-reader-documents');
	await manager.init();
	const document = await manager.createDocument({
		...importPayload,
		title: 'Web',
		file_name: 'webpage.html',
		source_type: 'webpage',
		mime_type: 'text/html',
		source_html: SOURCE_HTML,
	});

	const storedDocument = getDocuments('test-reader-documents').find(
		(candidate) => candidate._id === document._id
	);
	const loadedHtml = await manager.getSourceHtml(document._id);

	expect(storedDocument.source_html).toBeUndefined();
	expect(loadedHtml).toBe(SOURCE_HTML);
});

it('loads legacy inline source HTML when no attachment exists', async () => {
	const manager = new ReaderDocumentManager('test-reader-documents');
	await manager.init();
	const document = await manager.createDocument(importPayload);
	const storedDocument = getDocuments('test-reader-documents').find(
		(candidate) => candidate._id === document._id
	);
	storedDocument.source_html = SOURCE_HTML;

	await expect(manager.getSourceHtml(document._id)).resolves.toBe(SOURCE_HTML);
});

it('stores asset attachments after the source attachment', async () => {
	const manager = new ReaderDocumentManager('test-reader-documents');
	await manager.init();
	const sourceData = new Uint8Array(SOURCE_BYTES);
	const assetBytes = new Uint8Array([SOURCE_BYTE_NINE, SOURCE_BYTE_NINE, SOURCE_BYTE_ONE]);
	const document = await manager.createDocument({
		...importPayload,
		title: 'EPUB',
		file_name: 'book.epub',
		source_type: 'epub',
		mime_type: 'application/epub+zip',
		source_data: sourceData,
		asset_attachments: [
			{
				asset_id: 'cover.png',
				mime_type: 'image/png',
				data: assetBytes,
			},
		],
	});

	const loadedAsset = await manager.getAssetData(document._id, 'cover.png');

	expect(loadedAsset).toBeInstanceOf(ArrayBuffer);
	expect(Array.from(new Uint8Array(loadedAsset))).toEqual([
		SOURCE_BYTE_NINE,
		SOURCE_BYTE_NINE,
		SOURCE_BYTE_ONE,
	]);
});

it('updates document metadata', async () => {
	const manager = new ReaderDocumentManager('test-reader-documents');
	await manager.init();
	const document = await manager.createDocument(importPayload);

	const updated = await manager.updateMetadata(document._id, {
		title: 'New Story',
		color: '#91d7b4',
	});

	expect(updated.title).toBe('New Story');
	expect(updated.color).toBe('#91d7b4');
	expect(updated.reading_order).toEqual([
		{ href: 'text', type: 'text/plain', title: 'New Story' },
	]);
});

it('removes reader documents', async () => {
	const manager = new ReaderDocumentManager('test-reader-documents');
	await manager.init();
	const document = await manager.createDocument(importPayload);

	await manager.deleteDocument(document._id);
	const documents = await manager.getDocuments();
	expect(documents).toEqual([]);
});

it('rejects waitForInit when loading documents fails instead of hanging', async () => {
	vi.spyOn(console, 'error').mockImplementation(() => {});
	const manager = new ReaderDocumentManager('test-reader-documents-failure');
	manager._document_db.allDocs = vi.fn(() => Promise.reject(new Error('db failure')));

	await expect(manager.waitForInit()).rejects.toThrow(
		'There was an error loading reader documents.'
	);
	expect(manager.initialized).toBe(false);
});
