import { vi, beforeEach } from 'vitest';

// bookmarksStore is module-scoped, so we need a fresh module per describe block.
// We achieve this with vi.resetModules() + dynamic import in beforeEach.

let bookmarksStore;

const buildManager = (overrides = {}) => ({
	waitForInit: vi.fn(() => Promise.resolve()),
	getLists: vi.fn(() => Promise.resolve(['Bookmarks', 'Test List'])),
	createList: vi.fn(() => Promise.resolve()),
	deleteList: vi.fn(() => Promise.resolve()),
	addToList: vi.fn(() => Promise.resolve()),
	removeFromList: vi.fn(() => Promise.resolve()),
	updateProperty: vi.fn(() => Promise.resolve()),
	inList: vi.fn(() => Promise.resolve(['Bookmarks'])),
	getListContent: vi.fn(() => Promise.resolve([])),
	getEmptyLists: vi.fn(() => Promise.resolve([])),
	getWordByHash: vi.fn(() => Promise.resolve(undefined)),
	...overrides,
});

beforeEach(async () => {
	vi.resetModules();
	({ bookmarksStore } = await import('@/stores/bookmarks.svelte.js'));
});

it('should start with an empty lists array before refresh', () => {
	// Module-scoped $state initialises to [] before any refresh call
	expect(bookmarksStore.lists).toEqual([]);
});

it('refresh() should populate lists from the manager', async () => {
	global.window = { bookmarkManager: buildManager() };
	await bookmarksStore.refresh();
	expect(bookmarksStore.lists).toEqual(['Bookmarks', 'Test List']);
});

it('createList() should call the manager and add the name to the store', async () => {
	const manager = buildManager({
		getLists: vi.fn(() => Promise.resolve(['Bookmarks'])),
	});
	global.window = { bookmarkManager: manager };
	await bookmarksStore.refresh();

	await bookmarksStore.createList('HSK 1');
	expect(manager.createList).toHaveBeenCalledWith('HSK 1');
	expect(bookmarksStore.lists).toContain('HSK 1');
});

it('createList() should not duplicate an existing name', async () => {
	const manager = buildManager({
		getLists: vi.fn(() => Promise.resolve(['Bookmarks', 'Existing'])),
	});
	global.window = { bookmarkManager: manager };
	await bookmarksStore.refresh();

	await bookmarksStore.createList('Existing');
	const count = bookmarksStore.lists.filter((name) => name === 'Existing').length;
	expect(count).toBe(1);
});

it('deleteList() should call the manager and remove the name from the store', async () => {
	const manager = buildManager();
	global.window = { bookmarkManager: manager };
	await bookmarksStore.refresh();

	await bookmarksStore.deleteList('Test List');
	expect(manager.deleteList).toHaveBeenCalledWith('Test List');
	expect(bookmarksStore.lists).not.toContain('Test List');
});

it('addToList() should delegate straight through to the manager', async () => {
	const manager = buildManager();
	global.window = { bookmarkManager: manager };

	const word = { hash: 'abc123' };
	await bookmarksStore.addToList('Bookmarks', word);
	expect(manager.addToList).toHaveBeenCalledWith('Bookmarks', word);
});

it('removeFromList() should delegate straight through to the manager', async () => {
	const manager = buildManager();
	global.window = { bookmarkManager: manager };

	const word = { hash: 'abc123' };
	await bookmarksStore.removeFromList('Bookmarks', word);
	expect(manager.removeFromList).toHaveBeenCalledWith('Bookmarks', word);
});

it('getContent() should delegate straight through to the manager', async () => {
	const words = [{ hash: 'abc', simplified: '你好' }];
	const manager = buildManager({ getListContent: vi.fn(() => Promise.resolve(words)) });
	global.window = { bookmarkManager: manager };

	const result = await bookmarksStore.getContent('Bookmarks');
	expect(manager.getListContent).toHaveBeenCalledWith('Bookmarks');
	expect(result).toEqual(words);
});

it('should not remove other lists when deleteList() is called', async () => {
	const manager = buildManager();
	global.window = { bookmarkManager: manager };
	await bookmarksStore.refresh();

	await bookmarksStore.deleteList('Test List');
	expect(bookmarksStore.lists).toContain('Bookmarks');
});
