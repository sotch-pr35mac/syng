import { beforeEach, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import {
	BOOKMARK_SCHEMA_DOCUMENT_ID,
	BOOKMARK_SCHEMA_VERSION,
	BookmarkManager,
} from '@/utils/bookmarkManager.js';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

global.PouchDB = class {
	allDocs = vi.fn().mockResolvedValue({ rows: [] });
	get = vi.fn().mockRejectedValue({ status: 404, name: 'not_found' });
	put = vi.fn().mockResolvedValue({ ok: true });
	post = vi.fn().mockResolvedValue({ ok: true });
	bulkDocs = vi.fn().mockResolvedValue([]);
};

const hsk = (level = 'One') => ({
	hsk_2015: [level],
	proficiency_standard_2021: [],
	hsk_exam_syllabus_2025: [],
});

function managerWith({ marker, documents = [], levels = [] } = {}) {
	const manager = new BookmarkManager('schema-lists', 'schema-bookmarks');
	manager.initialized = true;
	manager._list_db.allDocs.mockResolvedValue({
		rows: [{ doc: { _id: 'list', name: 'Bookmarks' } }],
	});
	manager._document_db.get.mockImplementation(async () => {
		if (!marker) {
			throw { status: 404, name: 'not_found' };
		}
		return marker;
	});
	manager._document_db.allDocs.mockImplementation(async (options) => ({
		rows: options?.include_docs
			? documents.map((doc) => ({ doc }))
			: documents.map((doc) => ({ id: doc._id })),
	}));
	manager._document_db.bulkDocs.mockResolvedValue(
		documents.map((doc) => ({ ok: true, id: doc._id }))
	);
	vi.mocked(invoke).mockResolvedValue(levels);
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
	const word = { _id: 'word', simplified: '行', pinyin_numbers: 'hang2', hsk: 1 };
	const manager = managerWith({ marker, documents: [word], levels: [hsk('Two')] });
	const onStart = vi.fn();

	await expect(manager.prepareSchema(onStart)).resolves.toBe(true);
	expect(onStart).toHaveBeenCalledOnce();
	expect(invoke).toHaveBeenCalledWith('get_hsk_levels', {
		entries: [{ simplified: '行', pinyin_numbers: 'hang2' }],
	});
	expect(manager._document_db.bulkDocs).toHaveBeenCalledWith([{ ...word, hsk: hsk('Two') }]);
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
		levels: [hsk()],
	});
	const order = [];
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
	const document = { _id: 'one', simplified: '爱', pinyin_numbers: 'ai4' };
	const manager = managerWith({ documents: [document], levels: [hsk()] });
	manager._document_db.bulkDocs.mockRejectedValueOnce(new Error('write failed'));

	await expect(manager.prepareSchema()).rejects.toThrow('write failed');
	expect(manager.ready).toBe(false);
	expect(manager._document_db.put).not.toHaveBeenCalled();

	manager._document_db.bulkDocs.mockResolvedValueOnce([{ ok: true }]);
	await expect(manager.prepareSchema()).resolves.toBe(true);
	expect(manager.ready).toBe(true);
	expect(invoke).toHaveBeenCalledTimes(2);
});
