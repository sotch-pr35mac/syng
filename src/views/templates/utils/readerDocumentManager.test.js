import { vi } from 'vitest';
import { ReaderDocumentManager } from '@/utils/readerDocumentManager.js';

const documentsByDb = {};
const attachmentsByDb = {};
const SAVED_POSITION = 5;
const SAVED_POSITION_END = 8;
const SOURCE_BYTE_ONE = 1;
const SOURCE_BYTE_TWO = 2;
const SOURCE_BYTE_THREE = 3;
const SOURCE_BYTES = [SOURCE_BYTE_ONE, SOURCE_BYTE_TWO, SOURCE_BYTE_THREE];
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
