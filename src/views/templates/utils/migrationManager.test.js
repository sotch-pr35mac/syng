import { beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	fsFiles: new Map(),
	legacyFileContent: null,
	invoke: vi.fn(),
	readTextFile: vi.fn(),
	writeTextFile: vi.fn(),
	mkdir: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({
	invoke: mocks.invoke,
}));

vi.mock('@tauri-apps/api/path', () => ({
	appDataDir: vi.fn(() => Promise.resolve('/tmp/AppData/xyz.bytecraft.syng/')),
}));

vi.mock('@tauri-apps/plugin-fs', () => ({
	BaseDirectory: {
		AppData: 'AppData',
	},
	readTextFile: mocks.readTextFile,
	writeTextFile: mocks.writeTextFile,
	mkdir: mocks.mkdir,
}));

vi.mock('@tauri-apps/api/webviewWindow', () => ({
	getCurrentWebviewWindow: vi.fn(() => ({
		onCloseRequested: vi.fn(() => Promise.resolve()),
	})),
}));

vi.mock('@tauri-apps/plugin-os', () => ({
	platform: vi.fn(() => 'macos'),
}));

vi.mock('@/utils/error.js', () => ({
	handleError: vi.fn(),
}));

import {
	checkAndPerformMigration,
	exportMigrationData,
	importMigrationData,
} from '@/utils/migrationManager.js';

const MIGRATION_FILE_NAME = 'syng-migration-data.json';
const MIGRATION_COMPLETION_FILE_NAME = 'syng-migration-complete.json';
const SOURCE_BYTES = [1, 2, 3];

const clone = (value) => JSON.parse(JSON.stringify(value));

class FakeDb {
	constructor(documents = []) {
		this.documents = documents.map((document) => clone(document));
		this.attachments = new Map();
		this.putCalls = [];
	}

	allDocs(options = {}) {
		return Promise.resolve({
			rows: this.documents.map((document) =>
				options.include_docs ? { doc: clone(document) } : { id: document._id }
			),
		});
	}

	get(id) {
		const document = this.documents.find((candidate) => candidate._id === id);
		if (!document) {
			return Promise.reject({ status: 404 });
		}
		return Promise.resolve(clone(document));
	}

	put(document) {
		this.putCalls.push(clone(document));
		const index = this.documents.findIndex((candidate) => candidate._id === document._id);
		const revision = index < 0 ? 1 : Number(this.documents[index]._rev ?? 1) + 1;
		const nextDocument = {
			...clone(document),
			_rev: `${revision}`,
		};
		if (index < 0) {
			this.documents.push(nextDocument);
		} else {
			this.documents[index] = nextDocument;
		}
		return Promise.resolve({ ok: true, id: nextDocument._id, rev: nextDocument._rev });
	}

	remove(document) {
		const index = this.documents.findIndex((candidate) => candidate._id === document._id);
		if (index >= 0) {
			this.documents.splice(index, 1);
		}
		return Promise.resolve({ ok: true });
	}

	putAttachment(id, name, revision, data, contentType) {
		this.attachments.set(`${id}:${name}`, data);
		const index = this.documents.findIndex((candidate) => candidate._id === id);
		const nextRevision = `${Number(revision ?? this.documents[index]?._rev ?? 1) + 1}`;
		if (index >= 0) {
			this.documents[index] = {
				...this.documents[index],
				_rev: nextRevision,
				_attachments: {
					...(this.documents[index]._attachments ?? {}),
					[name]: { content_type: contentType },
				},
			};
		}
		return Promise.resolve({ ok: true, id, rev: nextRevision });
	}

	getAttachment(id, name) {
		const attachment = this.attachments.get(`${id}:${name}`);
		if (!attachment) {
			return Promise.reject({ status: 404 });
		}
		return Promise.resolve(attachment);
	}
}

const createManagers = ({
	config = [],
	wordLists = [],
	bookmarks = [],
	readerDocuments = [],
} = {}) => {
	const configDb = new FakeDb(config);
	const listDb = new FakeDb(wordLists);
	const bookmarkDb = new FakeDb(bookmarks);
	const readerDb = new FakeDb(readerDocuments);

	return {
		configDb,
		listDb,
		bookmarkDb,
		readerDb,
		preferenceManager: {
			_db: configDb,
			waitForInit: vi.fn(() => Promise.resolve()),
			init: vi.fn(() => Promise.resolve()),
		},
		bookmarkManager: {
			_list_db: listDb,
			_document_db: bookmarkDb,
			waitForInit: vi.fn(() => Promise.resolve()),
			init: vi.fn(() => Promise.resolve()),
		},
		readerDocumentManager: {
			_document_db: readerDb,
			waitForInit: vi.fn(() => Promise.resolve()),
			init: vi.fn(() => Promise.resolve()),
		},
	};
};

const migrationData = (databases) =>
	JSON.stringify({
		version: 2,
		exportedAt: '2026-01-01T00:00:00.000Z',
		databases,
	});

beforeEach(() => {
	mocks.fsFiles.clear();
	mocks.legacyFileContent = null;
	mocks.invoke.mockReset();
	mocks.invoke.mockImplementation(() => Promise.resolve(mocks.legacyFileContent));
	mocks.readTextFile.mockReset();
	mocks.readTextFile.mockImplementation((path) => {
		if (mocks.fsFiles.has(path)) {
			return Promise.resolve(mocks.fsFiles.get(path));
		}
		return Promise.reject(new Error('missing'));
	});
	mocks.writeTextFile.mockReset();
	mocks.writeTextFile.mockImplementation((path, contents) => {
		mocks.fsFiles.set(path, contents);
		return Promise.resolve();
	});
	mocks.mkdir.mockReset();
	mocks.mkdir.mockResolvedValue(undefined);
});

it('exports reader documents with source and asset attachments', async () => {
	const { preferenceManager, bookmarkManager, readerDocumentManager, readerDb } = createManagers({
		readerDocuments: [
			{
				_id: 'reader:1',
				title: 'PDF',
				imported_at: '2026-01-01T00:00:00.000Z',
				source_byte_length: SOURCE_BYTES.length,
				blocks: [
					{
						id: 'image-block',
						extensions: {
							image: { asset_id: 'image-1' },
						},
					},
				],
			},
		],
	});
	await readerDb.putAttachment(
		'reader:1',
		'source',
		'1',
		new Blob([new Uint8Array(SOURCE_BYTES)], { type: 'application/pdf' }),
		'application/pdf'
	);
	await readerDb.putAttachment(
		'reader:1',
		'assets/image-1',
		'2',
		new Blob([new Uint8Array([9])], { type: 'image/png' }),
		'image/png'
	);

	await exportMigrationData(preferenceManager, bookmarkManager, readerDocumentManager);

	const exported = JSON.parse(mocks.fsFiles.get(MIGRATION_FILE_NAME));
	expect(exported.version).toBe(2);
	expect(exported.databases.readerDocuments).toHaveLength(1);
	expect(exported.databases.readerDocuments[0].attachments.map((item) => item.name)).toEqual([
		'source',
		'assets/image-1',
	]);
	expect(exported.databases.readerDocuments[0].attachments[0].contentType).toBe(
		'application/pdf'
	);
});

it('imports v2 reader documents with attachments', async () => {
	const { preferenceManager, bookmarkManager, readerDocumentManager, readerDb } =
		createManagers();
	const fileContent = migrationData({
		config: [],
		wordLists: [],
		bookmarks: [],
		readerDocuments: [
			{
				doc: {
					_id: 'reader:1',
					title: 'Imported PDF',
					imported_at: '2026-01-01T00:00:00.000Z',
					_attachments: {
						source: { content_type: 'application/pdf' },
					},
				},
				attachments: [
					{
						name: 'source',
						contentType: 'application/pdf',
						data: btoa(String.fromCharCode(...SOURCE_BYTES)),
					},
				],
			},
		],
	});

	await importMigrationData(
		preferenceManager,
		bookmarkManager,
		readerDocumentManager,
		fileContent
	);

	const document = await readerDb.get('reader:1');
	const attachment = await readerDb.getAttachment('reader:1', 'source');
	expect(document.title).toBe('Imported PDF');
	expect(Array.from(new Uint8Array(await attachment.arrayBuffer()))).toEqual(SOURCE_BYTES);
});

it('uses the legacy identifier migration file when current stores are empty', async () => {
	const { preferenceManager, bookmarkManager, readerDocumentManager, bookmarkDb } =
		createManagers();
	mocks.legacyFileContent = migrationData({
		config: [],
		wordLists: [],
		bookmarks: [{ _id: 'bookmark:1', simplified: '词' }],
		readerDocuments: [],
	});

	await expect(
		checkAndPerformMigration(preferenceManager, bookmarkManager, readerDocumentManager)
	).resolves.toBe(true);

	expect(await bookmarkDb.get('bookmark:1')).toMatchObject({ simplified: '词' });
	expect(mocks.fsFiles.has(MIGRATION_COMPLETION_FILE_NAME)).toBe(true);
});

it('skips legacy import when current user data is not empty', async () => {
	const { preferenceManager, bookmarkManager, readerDocumentManager, bookmarkDb } =
		createManagers({
			bookmarks: [{ _id: 'bookmark:current', simplified: '现' }],
		});
	mocks.legacyFileContent = migrationData({
		config: [],
		wordLists: [],
		bookmarks: [{ _id: 'bookmark:legacy', simplified: '旧' }],
		readerDocuments: [],
	});

	await expect(
		checkAndPerformMigration(preferenceManager, bookmarkManager, readerDocumentManager)
	).resolves.toBe(false);

	await expect(bookmarkDb.get('bookmark:current')).resolves.toMatchObject({ simplified: '现' });
	await expect(bookmarkDb.get('bookmark:legacy')).rejects.toMatchObject({ status: 404 });
	expect(mocks.fsFiles.has(MIGRATION_COMPLETION_FILE_NAME)).toBe(false);
});

it('does not replay prefs-only migrations after completion is marked', async () => {
	const { preferenceManager, bookmarkManager, readerDocumentManager, configDb } =
		createManagers();
	mocks.legacyFileContent = migrationData({
		config: [{ _id: 'prefs', language: 'zh-Hant' }],
		wordLists: [],
		bookmarks: [],
		readerDocuments: [],
	});

	await expect(
		checkAndPerformMigration(preferenceManager, bookmarkManager, readerDocumentManager)
	).resolves.toBe(true);
	mocks.legacyFileContent = migrationData({
		config: [{ _id: 'prefs', language: 'zh-Hans' }],
		wordLists: [],
		bookmarks: [],
		readerDocuments: [],
	});

	await expect(
		checkAndPerformMigration(preferenceManager, bookmarkManager, readerDocumentManager)
	).resolves.toBe(false);

	expect(await configDb.get('prefs')).toMatchObject({ language: 'zh-Hant' });
});
