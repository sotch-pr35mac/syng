import { beforeEach, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { BookmarkManager } from '@/utils/bookmarkManager.js';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

const lexicalIdFor = (suffix) => `1:${suffix.padEnd(64, '0')}`;

// Mock the PouchDB API
const getRandomNumber = () => Math.floor(Math.random() * 1000000);
const getDocuments = (dbName) => {
	switch (dbName) {
		case 'test-lists-empty':
			return [];
		case 'test-lists':
			return [
				{
					doc: {
						_id: 'bookmarks',
						name: 'Bookmarks',
					},
				},
				{
					doc: {
						_id: 'test-list-1',
						name: 'Test List 1',
					},
				},
				{
					doc: {
						_id: 'test-list-2',
						name: 'Test List 2',
					},
				},
			];
		case 'test-bookmarks-empty':
			return [];
		case 'test-bookmarks':
			return [
				{
					doc: {
						_id: '123',
						_rev: '1',
						lexical_id: lexicalIdFor('123'),
						notes: '',
						lists: ['test-list-1', 'test-list-2'],
					},
				},
				{
					doc: {
						_id: '456',
						_rev: '1',
						lexical_id: lexicalIdFor('456'),
						notes: '',
						lists: ['test-list-1'],
					},
				},
				{
					doc: {
						_id: '789',
						_rev: '1',
						lexical_id: lexicalIdFor('789'),
						notes: '',
						lists: ['test-list-2'],
					},
				},
				{
					doc: {
						_id: '101112',
						_rev: '1',
						lexical_id: lexicalIdFor('101112'),
						notes: '',
						lists: ['test-list-1', 'test-list-2', 'bookmarks'],
					},
				},
				{
					doc: {
						_id: '131415',
						_rev: '1',
						lexical_id: lexicalIdFor('131415'),
						notes: '',
						lists: ['bookmarks'],
					},
				},
				{
					doc: {
						_id: '161718',
						_rev: '1',
						lexical_id: lexicalIdFor('161718'),
						notes: '',
						lists: ['bookmarks', 'test-list-1'],
					},
				},
			];
		case 'test-lists-duplicate':
			return [
				{ doc: { _id: 'bookmarks-a', _rev: '1', name: 'Bookmarks' } },
				{ doc: { _id: 'bookmarks-b', _rev: '1', name: 'Bookmarks' } },
				{ doc: { _id: 'other', _rev: '1', name: 'Other' } },
			];
		case 'test-bookmarks-duplicate':
			return [
				{
					doc: {
						_id: 'w1',
						_rev: '1',
						lexical_id: lexicalIdFor('a1'),
						notes: '',
						lists: ['bookmarks-a'],
					},
				},
				{
					doc: {
						_id: 'w2',
						_rev: '1',
						lexical_id: lexicalIdFor('a2'),
						notes: '',
						lists: ['bookmarks-b'],
					},
				},
				{
					doc: {
						_id: 'w3',
						_rev: '1',
						lexical_id: lexicalIdFor('a3'),
						notes: '',
						lists: ['bookmarks-a', 'bookmarks-b'],
					},
				},
				{
					doc: {
						_id: 'w4',
						_rev: '1',
						lexical_id: lexicalIdFor('a4'),
						notes: '',
						lists: ['other'],
					},
				},
			];
		default:
			throw new Error(`Unknown database name: ${dbName}`);
	}
};
global.PouchDB = class {
	constructor(dbName) {
		const documents = getDocuments(dbName);

		this.put = vi.fn((newItem) => {
			if (newItem._deleted) {
				const index = documents.findIndex((doc) => doc.doc._id === newItem._id);
				documents.splice(index, 1);
				return Promise.resolve({
					ok: true,
					id: newItem._id,
					rev: getRandomNumber(),
				});
			} else {
				const index = documents.findIndex((doc) => doc.doc._id === newItem._id);
				documents[index] = { doc: newItem };
				return Promise.resolve({
					ok: true,
					id: newItem._id,
					rev: getRandomNumber(),
				});
			}
		});
		this.post = vi.fn((newItem) => {
			const itemWithId = {
				_id: getRandomNumber(),
				_rev: getRandomNumber(),
				...newItem,
			};
			documents.push({ doc: itemWithId });
			return Promise.resolve({
				ok: true,
				id: itemWithId._id,
				rev: itemWithId._rev,
			});
		});
		this.allDocs = vi.fn(() =>
			Promise.resolve({
				rows: documents,
			})
		);
		this.remove = vi.fn((itemToRemove) => {
			const index = documents.findIndex((doc) => doc.doc._id === itemToRemove._id);
			documents.splice(index, 1);
			console.error('test');
			return Promise.resolve({
				ok: true,
				id: itemToRemove._id,
				rev: getRandomNumber(),
			});
		});
		this.bulkDocs = vi.fn((items) => {
			items.forEach((item) => {
				if (!item._id) {
					const itemWithId = {
						_id: getRandomNumber(),
						_rev: getRandomNumber(),
						...item,
					};
					documents.push({ doc: itemWithId });
				} else {
					if (item._deleted) {
						const index = documents.findIndex((doc) => doc.doc._id === item._id);
						documents.splice(index, 1);
					} else {
						const index = documents.findIndex((doc) => doc.doc._id === item._id);
						documents[index] = { doc: item };
					}
				}
			});
			return Promise.resolve(
				items.map((item) => ({
					ok: true,
					id: item._id,
					rev: getRandomNumber(),
				}))
			);
		});
	}
};

beforeEach(() => {
	invoke.mockImplementation((_command, args = {}) =>
		Promise.resolve(
			Array.isArray(args.ids) ? args.ids.map((lexicalId) => ({ id: lexicalId })) : undefined
		)
	);
});

it('should create a bookmarks list if it does not exist', async () => {
	const bookmarkManager = new BookmarkManager('test-lists-empty', 'test-bookmarks-empty');
	await bookmarkManager.init();
	const listNames = await bookmarkManager.getLists();
	expect(listNames).toEqual(['Bookmarks']);
});

it('should return an array of list names', async () => {
	const bookmarkManager = new BookmarkManager('test-lists', 'test-bookmarks');
	await bookmarkManager.init();
	const listNames = await bookmarkManager.getLists();
	expect(listNames).toEqual(['Bookmarks', 'Test List 1', 'Test List 2']);
});

it('should collapse duplicate-named lists and merge their word references on init', async () => {
	const bookmarkManager = new BookmarkManager('test-lists-duplicate', 'test-bookmarks-duplicate');
	await bookmarkManager.init();

	// The two 'Bookmarks' documents collapse to one; 'Other' is untouched.
	const listNames = await bookmarkManager.getLists();
	expect(listNames).toEqual(['Bookmarks', 'Other']);

	// Every word that referenced either 'Bookmarks' copy now resolves under the single list.
	const bookmarksContent = await bookmarkManager.getListContent('Bookmarks');
	expect(bookmarksContent.map((word) => word.lexical_id).sort()).toEqual([
		lexicalIdFor('a1'),
		lexicalIdFor('a2'),
		lexicalIdFor('a3'),
	]);

	// A word that lived in both copies is merged onto the canonical id without duplication.
	const mergedWord = await bookmarkManager.getWordByLexicalId(lexicalIdFor('a3'));
	expect(mergedWord.lists).toEqual(['bookmarks-a']);
});

it('should create a new list', async () => {
	const bookmarkManager = new BookmarkManager('test-lists', 'test-bookmarks');
	await bookmarkManager.init();
	await bookmarkManager.createList('New List');
	const listNames = await bookmarkManager.getLists();
	expect(listNames).toEqual(['Bookmarks', 'Test List 1', 'Test List 2', 'New List']);
});

it('should refuse to create a list with a name that already exists', async () => {
	const bookmarkManager = new BookmarkManager('test-lists', 'test-bookmarks');
	await bookmarkManager.init();
	await expect(bookmarkManager.createList('Test List 1')).rejects.toThrow();
});

it('should delete a list', async () => {
	const bookmarkManager = new BookmarkManager('test-lists', 'test-bookmarks');
	await bookmarkManager.init();
	await bookmarkManager.deleteList('Test List 1');
	const listNames = await bookmarkManager.getLists();
	expect(listNames).toEqual(['Bookmarks', 'Test List 2']);
});

it('should refuse to delete a list that does not exist', async () => {
	const bookmarkManager = new BookmarkManager('test-lists', 'test-bookmarks');
	await bookmarkManager.init();
	await expect(bookmarkManager.deleteList('Nonexistent List')).rejects.toThrow();
});

it('should remove word entries on list deletion', async () => {
	const bookmarkManager = new BookmarkManager('test-lists', 'test-bookmarks');
	await bookmarkManager.init();
	await bookmarkManager.deleteList('Test List 1');
	const multiple = await bookmarkManager.getWordByLexicalId(lexicalIdFor('123'));
	expect(multiple.lists).toEqual(['test-list-2']);

	const single = await bookmarkManager.getWordByLexicalId(lexicalIdFor('456'));
	expect(single).toBeUndefined();
});

it('should return word entries for a given list', async () => {
	const bookmarkManager = new BookmarkManager('test-lists', 'test-bookmarks');
	await bookmarkManager.init();
	const wordEntries = await bookmarkManager.getListContent('Test List 1');
	expect(wordEntries.map((word) => word.lexical_id)).toEqual([
		lexicalIdFor('123'),
		lexicalIdFor('456'),
		lexicalIdFor('101112'),
		lexicalIdFor('161718'),
	]);
});

it('should return a word entry for a given lexical ID', async () => {
	const bookmarkManager = new BookmarkManager('test-lists', 'test-bookmarks');
	await bookmarkManager.init();
	const wordEntry = await bookmarkManager.getWordByLexicalId(lexicalIdFor('123'));
	expect(wordEntry).toEqual({
		_id: '123',
		_rev: '1',
		lexical_id: lexicalIdFor('123'),
		notes: '',
		lists: ['test-list-1', 'test-list-2'],
	});
});

it('should return undefined for a lexical ID that does not exist', async () => {
	const bookmarkManager = new BookmarkManager('test-lists', 'test-bookmarks');
	await bookmarkManager.init();
	const wordEntry = await bookmarkManager.getWordByLexicalId(lexicalIdFor('nonexistent'));
	expect(wordEntry).toBeUndefined();
});

it('should add an existing word entry to a list', async () => {
	const bookmarkManager = new BookmarkManager('test-lists', 'test-bookmarks');
	await bookmarkManager.init();
	let wordEntry = await bookmarkManager.getWordByLexicalId(lexicalIdFor('456'));
	await bookmarkManager.addToList('Test List 2', wordEntry);
	wordEntry = await bookmarkManager.getWordByLexicalId(lexicalIdFor('456'));
	expect(wordEntry.lists).toEqual(['test-list-1', 'test-list-2']);
});

it('should add a new word entry to a list', async () => {
	const bookmarkManager = new BookmarkManager('test-lists', 'test-bookmarks');
	await bookmarkManager.init();
	await bookmarkManager.addToList('Test List 2', { lexical_id: lexicalIdFor('999') });
	const wordEntry = await bookmarkManager.getWordByLexicalId(lexicalIdFor('999'));
	expect(wordEntry.lists).toEqual(['test-list-2']);
});

it('should preserve notes when adding a new word entry to a list', async () => {
	const bookmarkManager = new BookmarkManager('test-lists', 'test-bookmarks');
	await bookmarkManager.init();
	await bookmarkManager.addToList('Test List 2', {
		lexical_id: lexicalIdFor('999'),
		notes: 'Imported note',
	});
	const wordEntry = await bookmarkManager.getWordByLexicalId(lexicalIdFor('999'));
	expect(wordEntry.notes).toBe('Imported note');
});

it('should ignore a request to add a word entry to a list that it is already apart of', async () => {
	const bookmarkManager = new BookmarkManager('test-lists', 'test-bookmarks');
	await bookmarkManager.init();
	let wordEntry = await bookmarkManager.getWordByLexicalId(lexicalIdFor('123'));
	await bookmarkManager.addToList('Test List 1', wordEntry);
	wordEntry = await bookmarkManager.getWordByLexicalId(lexicalIdFor('123'));
	expect(wordEntry.lists).toEqual(['test-list-1', 'test-list-2']);
});

it('should refuse to add a word entry to a list that does not exist', async () => {
	const bookmarkManager = new BookmarkManager('test-lists', 'test-bookmarks');
	await bookmarkManager.init();
	await expect(
		bookmarkManager.addToList('Nonexistent List', { lexical_id: lexicalIdFor('999') })
	).rejects.toThrow();
});

it('should remove a word entry from a list', async () => {
	const bookmarkManager = new BookmarkManager('test-lists', 'test-bookmarks');
	await bookmarkManager.init();
	let wordEntry = await bookmarkManager.getWordByLexicalId(lexicalIdFor('123'));
	await bookmarkManager.removeFromList('Test List 1', wordEntry);
	wordEntry = await bookmarkManager.getWordByLexicalId(lexicalIdFor('123'));
	expect(wordEntry.lists).toEqual(['test-list-2']);
});

it('should refuse to remove a word entry from a list that does not exist', async () => {
	const bookmarkManager = new BookmarkManager('test-lists', 'test-bookmarks');
	await bookmarkManager.init();
	await expect(
		bookmarkManager.removeFromList('Nonexistent List', { lexical_id: lexicalIdFor('999') })
	).rejects.toThrow();
});

it('should refuse to remove a word entry that does not exist', async () => {
	const bookmarkManager = new BookmarkManager('test-lists', 'test-bookmarks');
	await bookmarkManager.init();
	await expect(
		bookmarkManager.removeFromList('Test List 1', { lexical_id: lexicalIdFor('999') })
	).rejects.toThrow();
});

it('should return the same lexical-ID bookmark on repeated reads', async () => {
	const bookmarkManager = new BookmarkManager('test-lists', 'test-bookmarks');
	await bookmarkManager.init();
	const wordEntry = await bookmarkManager.getWordByLexicalId(lexicalIdFor('123'));
	expect(wordEntry).toEqual({
		_id: '123',
		_rev: '1',
		lexical_id: lexicalIdFor('123'),
		notes: '',
		lists: ['test-list-1', 'test-list-2'],
	});
});

it('should return undefined for an unknown lexical ID', async () => {
	const bookmarkManager = new BookmarkManager('test-lists', 'test-bookmarks');
	await bookmarkManager.init();
	const wordEntry = await bookmarkManager.getWordByLexicalId(lexicalIdFor('nonexistent'));
	expect(wordEntry).toBeUndefined();
});

it('should update a word entry property', async () => {
	const bookmarkManager = new BookmarkManager('test-lists', 'test-bookmarks');
	await bookmarkManager.init();
	await bookmarkManager.updateProperty(lexicalIdFor('123'), 'notes', 'new notes');
	const wordEntry = await bookmarkManager.getWordByLexicalId(lexicalIdFor('123'));
	expect(wordEntry.notes).toEqual('new notes');
});

it('should refuse to update a word entry property for an unknown lexical ID', async () => {
	const bookmarkManager = new BookmarkManager('test-lists', 'test-bookmarks');
	await bookmarkManager.init();
	await expect(
		bookmarkManager.updateProperty(lexicalIdFor('999'), 'notes', 'new notes')
	).rejects.toThrow();
});

it('should refuse to update a word entry property for an unsupported property', async () => {
	const bookmarkManager = new BookmarkManager('test-lists', 'test-bookmarks');
	await bookmarkManager.init();
	await expect(
		bookmarkManager.updateProperty(lexicalIdFor('123'), 'unsupported', 'new notes')
	).rejects.toThrow();
});
