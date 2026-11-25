import { expect, it, vi } from 'vitest';
import { BookmarkManager } from '@/utils/bookmarkManager.js';
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
it('groups memberships into one write and retains notes and existing memberships', async () => {
	const lexicalId = `1:${'a'.repeat(64)}`;
	const document = {
		_id: 'existing',
		_rev: '1',
		lexical_id: lexicalId,
		notes: 'My note',
		lists: ['old'],
	};
	const manager = Object.create(BookmarkManager.prototype);
	manager._list_db = {
		allDocs: vi.fn().mockResolvedValue({ rows: [] }),
		put: vi.fn().mockResolvedValue({ ok: true }),
	};
	manager._document_db = {
		allDocs: vi.fn().mockResolvedValue({ rows: [{ doc: document }] }),
		bulkDocs: vi.fn().mockResolvedValue([{ ok: true }]),
	};
	await manager.importLists([
		{ id: 'one', name: 'One', lexicalIds: [lexicalId, lexicalId] },
		{ id: 'two', name: 'Two', lexicalIds: [lexicalId] },
	]);
	expect(manager._document_db.bulkDocs).toHaveBeenCalledExactlyOnceWith([
		{ ...document, lists: ['old', 'one', 'two'] },
	]);
});
it('merges conflict retries with fresh notes and memberships', async () => {
	const lexicalId = `1:${'b'.repeat(64)}`;
	const manager = Object.create(BookmarkManager.prototype);
	manager._list_db = {
		allDocs: vi.fn().mockResolvedValue({ rows: [{ doc: { _id: 'one', name: 'One' } }] }),
	};
	manager._document_db = {
		allDocs: vi.fn().mockResolvedValue({
			rows: [{ doc: { _id: 'word', lexical_id: lexicalId, lists: ['old'], notes: 'old' } }],
		}),
		get: vi.fn().mockResolvedValue({
			_id: 'word',
			_rev: '2',
			lexical_id: lexicalId,
			lists: ['old', 'other'],
			notes: 'new note',
		}),
		bulkDocs: vi
			.fn()
			.mockResolvedValueOnce([{ status: 409 }])
			.mockResolvedValueOnce([{ ok: true }]),
	};
	await manager.importLists([{ id: 'one', name: 'One', lexicalIds: [lexicalId] }]);
	expect(manager._document_db.bulkDocs.mock.calls[1][0][0]).toMatchObject({
		notes: 'new note',
		lists: ['old', 'other', 'one'],
		_rev: '2',
	});
});
