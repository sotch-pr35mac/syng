import { beforeEach, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import {
	BOOKMARK_RECOVERY_DOCUMENT_ID,
	BOOKMARK_SCHEMA_DOCUMENT_ID,
	BOOKMARK_SCHEMA_VERSION,
	BookmarkManager,
} from '@/utils/bookmarkManager.js';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

const LEXICAL_ID = '1:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

type TestDocument = {
	_id: string;
	_rev?: string;
	simplified?: string;
	traditional?: string;
	pinyin_numbers?: string;
	lexical_id?: string;
	lists?: string[];
	notes?: string;
	_deleted?: boolean;
	[key: string]: unknown;
};

type SchemaMarker = {
	_id: string;
	_rev?: string;
	version: number;
};

type AllDocsOptions = {
	include_docs?: boolean;
	limit?: number;
};

type DatabaseResult = {
	ok: boolean;
	id?: string;
};

class PouchDbMock {
	allDocs = vi.fn((_options?: AllDocsOptions) =>
		Promise.resolve({ rows: [] as Array<{ doc?: TestDocument; id?: string }> })
	);
	get = vi.fn((_id: string) =>
		Promise.reject(Object.assign(new Error('not_found'), { status: 404, name: 'not_found' }))
	);
	put = vi.fn((_document: TestDocument | SchemaMarker) =>
		Promise.resolve<DatabaseResult>({ ok: true })
	);
	post = vi.fn((_document: TestDocument) => Promise.resolve<DatabaseResult>({ ok: true }));
	bulkDocs = vi.fn((_documents: TestDocument[]) => Promise.resolve<DatabaseResult[]>([]));

	constructor(_name: string) {}
}

(globalThis as typeof globalThis & { PouchDB: typeof PouchDbMock }).PouchDB = PouchDbMock;

type Resolution = {
	unit: { id: string } | null;
	reason: string | null;
};

type ManagerOptions = {
	marker?: SchemaMarker;
	documents?: TestDocument[];
	resolutions?: Resolution[];
	recoveryReport?: TestDocument;
};

function managerWith({
	marker,
	documents = [],
	resolutions = documents.map(() => ({ unit: { id: LEXICAL_ID }, reason: null })),
	recoveryReport,
}: ManagerOptions = {}) {
	const manager = new BookmarkManager('schema-lists', 'schema-bookmarks');
	manager.initialized = true;
	manager._list_db.allDocs.mockResolvedValue({
		rows: [{ doc: { _id: 'list', name: 'Bookmarks' } }],
	});
	manager._document_db.get.mockImplementation(async (id: string) => {
		if (id === BOOKMARK_SCHEMA_DOCUMENT_ID && marker) {
			return marker;
		}
		if (id === BOOKMARK_RECOVERY_DOCUMENT_ID && recoveryReport) {
			return recoveryReport;
		}
		{
			throw Object.assign(new Error('not_found'), { status: 404, name: 'not_found' });
		}
	});
	manager._document_db.allDocs.mockImplementation(
		async (options: AllDocsOptions | undefined) => ({
			rows: options?.include_docs
				? documents.map((document) => ({ doc: document }))
				: documents.map((document) => ({ id: document._id })),
		})
	);
	manager._document_db.bulkDocs.mockResolvedValue(
		documents.map((document) => ({ ok: true, id: document._id }))
	);
	vi.mocked(invoke).mockResolvedValue(resolutions);
	return manager;
}

beforeEach(() => vi.clearAllMocks());

it('does one local lookup and no bookmark scan for a current schema', async () => {
	const manager = managerWith({
		marker: { _id: BOOKMARK_SCHEMA_DOCUMENT_ID, version: BOOKMARK_SCHEMA_VERSION },
		documents: [{ _id: 'word' }],
	});

	await expect(manager.prepareSchema()).resolves.toBe(false);
	expect(manager._document_db.get).toHaveBeenCalledOnce();
	expect(manager._document_db.allDocs).not.toHaveBeenCalled();
	expect(invoke).not.toHaveBeenCalled();
	await expect(manager.waitForReady()).resolves.toBeUndefined();
});

it.each([
	['missing', undefined],
	['stale', { _id: BOOKMARK_SCHEMA_DOCUMENT_ID, _rev: '1-a', version: 0 }],
])('migrates a populated database with a %s marker', async (_label, marker) => {
	const word: TestDocument = {
		_id: 'word',
		simplified: '行',
		traditional: '行',
		pinyin_numbers: 'hang2',
		lists: ['Bookmarks'],
		notes: 'Keep this note',
	};
	const manager = managerWith({ marker, documents: [word] });
	const onStart = vi.fn();

	await expect(manager.prepareSchema(onStart)).resolves.toBe(true);
	expect(onStart).toHaveBeenCalledOnce();
	expect(invoke).toHaveBeenCalledWith('resolve_legacy_lexical_units', {
		entries: [
			{
				simplified: '行',
				traditional: '行',
				pinyin_numbers: 'hang2',
				tone_marks: [],
				english: [],
			},
		],
	});
	expect(manager._document_db.bulkDocs).toHaveBeenCalledWith([
		{ _id: 'word', lexical_id: LEXICAL_ID, lists: ['Bookmarks'], notes: 'Keep this note' },
	]);
	expect(manager._document_db.put).toHaveBeenCalledWith({
		...(marker ?? {}),
		_id: BOOKMARK_SCHEMA_DOCUMENT_ID,
		version: BOOKMARK_SCHEMA_VERSION,
	});
});

it('marks an empty database current without showing or invoking the migration', async () => {
	const manager = managerWith();
	const onStart = vi.fn();

	await expect(manager.prepareSchema(onStart)).resolves.toBe(false);
	expect(onStart).not.toHaveBeenCalled();
	expect(invoke).not.toHaveBeenCalled();
	expect(manager._document_db.put).toHaveBeenCalledOnce();
});

it('persists bookmark batches before advancing the schema marker', async () => {
	const manager = managerWith({
		documents: [{ _id: 'one', simplified: '爱', pinyin_numbers: 'ai4' }],
	});
	const order: string[] = [];
	manager._document_db.bulkDocs.mockImplementation(async () => {
		order.push('bookmarks');
		return [{ ok: true }];
	});
	manager._document_db.put.mockImplementation(async () => {
		order.push('marker');
		return { ok: true };
	});

	await manager.prepareSchema();
	expect(order).toEqual(['bookmarks', 'marker']);
});

it('does not advance readiness or the marker after a failed batch and retries later', async () => {
	const document: TestDocument = {
		_id: 'one',
		simplified: '爱',
		traditional: '愛',
		pinyin_numbers: 'ai4',
	};
	const manager = managerWith({ documents: [document] });
	manager._document_db.bulkDocs.mockRejectedValueOnce(new Error('write failed'));

	await expect(manager.prepareSchema()).rejects.toThrow('write failed');
	expect(manager.ready).toBe(false);
	expect(manager._document_db.put).not.toHaveBeenCalled();

	manager._document_db.bulkDocs.mockResolvedValueOnce([{ ok: true }]);
	await expect(manager.prepareSchema()).resolves.toBe(true);
	expect(manager.ready).toBe(true);
	expect(invoke).toHaveBeenCalledTimes(2);
});

it('durably writes an unresolved recovery report before deleting legacy data', async () => {
	const legacy: TestDocument = {
		_id: 'missing',
		simplified: '不存在',
		traditional: '不存在',
		pinyin_numbers: 'bu4 cun2 zai4',
		lists: ['Bookmarks'],
		notes: 'Do not lose this',
	};
	const manager = managerWith({
		documents: [legacy],
		resolutions: [{ unit: null, reason: 'No matching current dictionary entry was found.' }],
	});
	const order: string[] = [];
	manager._document_db.put.mockImplementation(async (document: TestDocument | SchemaMarker) => {
		order.push(
			(document as TestDocument)._id === BOOKMARK_RECOVERY_DOCUMENT_ID ? 'report' : 'marker'
		);
		return { ok: true };
	});
	manager._document_db.bulkDocs.mockImplementation(async () => {
		order.push('bookmarks');
		return [{ ok: true }];
	});

	await expect(manager.prepareSchema()).resolves.toBe(true);
	expect(order).toEqual(['report', 'bookmarks', 'marker']);
	expect(manager._document_db.bulkDocs).toHaveBeenCalledWith([
		expect.objectContaining({ _id: 'missing', _deleted: true }),
	]);
	expect(manager._document_db.put).toHaveBeenCalledWith(
		expect.objectContaining({
			_id: BOOKMARK_RECOVERY_DOCUMENT_ID,
			report: expect.stringContaining('Do not lose this'),
		})
	);
});
