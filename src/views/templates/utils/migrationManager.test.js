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

const clone = (value) => JSON.parse(JSON.stringify(value));

class FakeDb {
	constructor(documents = []) {
		this.documents = documents.map((document) => clone(document));
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
}

const createManagers = ({ config = [], wordLists = [], bookmarks = [] } = {}) => {
	const configDb = new FakeDb(config);
	const listDb = new FakeDb(wordLists);
	const bookmarkDb = new FakeDb(bookmarks);

	return {
		configDb,
		listDb,
		bookmarkDb,
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

it('exports beta migration databases with identifier metadata', async () => {
	const { preferenceManager, bookmarkManager } = createManagers({
		config: [{ _id: 'config', toneColors: {} }],
		wordLists: [{ _id: 'list:1', name: 'Bookmarks' }],
		bookmarks: [{ _id: 'bookmark:1', simplified: '词' }],
	});

	await exportMigrationData(preferenceManager, bookmarkManager);

	const exported = JSON.parse(mocks.fsFiles.get(MIGRATION_FILE_NAME));
	expect(exported).toMatchObject({
		version: 2,
		identifiers: {
			current: 'xyz.bytecraft.syng',
			legacy: 'org.syng.app',
		},
		databases: {
			config: [{ _id: 'config', toneColors: {} }],
			wordLists: [{ _id: 'list:1', name: 'Bookmarks' }],
			bookmarks: [{ _id: 'bookmark:1', simplified: '词' }],
		},
	});
	expect(exported.databases).not.toHaveProperty('readerDocuments');
});

it('imports migration data into preferences, word lists, and bookmarks', async () => {
	const { preferenceManager, bookmarkManager, configDb, listDb, bookmarkDb } = createManagers({
		wordLists: [{ _id: 'default', name: 'Bookmarks' }],
	});
	const fileContent = migrationData({
		config: [{ _id: 'prefs', language: 'zh-Hant' }],
		wordLists: [{ _id: 'legacy-list', name: 'Bookmarks' }],
		bookmarks: [{ _id: 'bookmark:1', simplified: '词' }],
	});

	await importMigrationData(preferenceManager, bookmarkManager, fileContent);

	expect(await configDb.get('prefs')).toMatchObject({ language: 'zh-Hant' });
	expect(await listDb.get('legacy-list')).toMatchObject({ name: 'Bookmarks' });
	await expect(listDb.get('default')).rejects.toMatchObject({ status: 404 });
	expect(await bookmarkDb.get('bookmark:1')).toMatchObject({ simplified: '词' });
});

it('uses the legacy identifier migration file when current stores are empty', async () => {
	const { preferenceManager, bookmarkManager, bookmarkDb } = createManagers();
	mocks.legacyFileContent = migrationData({
		config: [],
		wordLists: [],
		bookmarks: [{ _id: 'bookmark:1', simplified: '词' }],
	});

	await expect(checkAndPerformMigration(preferenceManager, bookmarkManager)).resolves.toBe(true);

	expect(await bookmarkDb.get('bookmark:1')).toMatchObject({ simplified: '词' });
	expect(mocks.fsFiles.has(MIGRATION_COMPLETION_FILE_NAME)).toBe(true);
});

it('skips legacy import when current user data is not empty', async () => {
	const { preferenceManager, bookmarkManager, bookmarkDb } = createManagers({
		bookmarks: [{ _id: 'bookmark:current', simplified: '现' }],
	});
	mocks.legacyFileContent = migrationData({
		config: [],
		wordLists: [],
		bookmarks: [{ _id: 'bookmark:legacy', simplified: '旧' }],
	});

	await expect(checkAndPerformMigration(preferenceManager, bookmarkManager)).resolves.toBe(false);

	await expect(bookmarkDb.get('bookmark:current')).resolves.toMatchObject({ simplified: '现' });
	await expect(bookmarkDb.get('bookmark:legacy')).rejects.toMatchObject({ status: 404 });
	expect(mocks.fsFiles.has(MIGRATION_COMPLETION_FILE_NAME)).toBe(false);
});

it('does not replay prefs-only migrations after completion is marked', async () => {
	const { preferenceManager, bookmarkManager, configDb } = createManagers();
	mocks.legacyFileContent = migrationData({
		config: [{ _id: 'prefs', language: 'zh-Hant' }],
		wordLists: [],
		bookmarks: [],
	});

	await expect(checkAndPerformMigration(preferenceManager, bookmarkManager)).resolves.toBe(true);
	mocks.legacyFileContent = migrationData({
		config: [{ _id: 'prefs', language: 'zh-Hans' }],
		wordLists: [],
		bookmarks: [],
	});

	await expect(checkAndPerformMigration(preferenceManager, bookmarkManager)).resolves.toBe(false);

	expect(await configDb.get('prefs')).toMatchObject({ language: 'zh-Hant' });
});
