import type { SearchEntry } from '@/types/search.js';
import { getBookmarkManager } from '@/utils/appServices.js';
import { handleError } from '@/utils/error.js';

/**
 * A word entry as stored by BookmarkManager in the documents PouchDB. Extends SearchEntry
 * with the bookmark-specific fields added when a word is saved to a list.
 */
export type BookmarkWordEntry = SearchEntry & {
	_id: string;
	_rev: string;
	lists: string[];
	notes: string;
};

/**
 * Shape accepted by addToList/removeFromList. In practice callers pass a SearchEntry (or
 * an imported archive entry). The only field the manager requires is `hash`.
 */
export type BookmarkWordInput = { hash: string } & Record<string, unknown>;

/**
 * Reactive, app-lifetime cache of bookmark list names, plus a façade around the rest of
 * BookmarkManager so views never need to touch the manager directly. This is strictly
 * additive: the manager still owns all PouchDB persistence and its on-disk behavior is
 * unchanged. See utils/bookmarkManager.js for the persistence layer.
 *
 * Caching strategy:
 *   - List names (the most frequently read piece — shown in Search, Bookmarks, Quiz) are
 *     cached and updated optimistically after every mutation that affects them.
 *   - List contents, inList lookups, and word-entry queries pass straight through to the
 *     manager. They are called infrequently enough that caching them is not worth the
 *     invalidation complexity.
 *
 * Mutation policy:
 *   - All bookmark mutations in the app MUST go through this store. The store is the
 *     single update path so the cached list-name array stays authoritative. If a future
 *     flow bypasses the store (e.g. a migration, an import that hits the manager directly
 *     in a loop), it should call `refresh()` at the end.
 */

let lists = $state<string[]>([]);
let initialized = $state(false);

async function ensureManagerReady(): Promise<void> {
	// The manager is constructed synchronously in runStartupActions. waitForInit is still
	// needed to ensure the PouchDB load has completed before we issue queries.
	await getBookmarkManager().waitForInit();
}

async function refresh(): Promise<void> {
	try {
		await ensureManagerReady();
		lists = await getBookmarkManager().getLists();
		initialized = true;
	} catch (error) {
		handleError(
			'There was an error fetching bookmark lists. Check the logs for more details.',
			error
		);
	}
}

async function createList(name: string): Promise<void> {
	await ensureManagerReady();
	await getBookmarkManager().createList(name);
	if (!lists.includes(name)) {
		lists = [...lists, name];
	}
}

async function deleteList(name: string): Promise<void> {
	await ensureManagerReady();
	await getBookmarkManager().deleteList(name);
	lists = lists.filter((listName) => listName !== name);
}

async function addToList(listName: string, word: BookmarkWordInput): Promise<void> {
	await ensureManagerReady();
	await getBookmarkManager().addToList(listName, word);
}

async function removeFromList(listName: string, word: BookmarkWordInput): Promise<void> {
	await ensureManagerReady();
	await getBookmarkManager().removeFromList(listName, word);
}

async function updateProperty(hash: string, name: string, value: unknown): Promise<void> {
	await ensureManagerReady();
	await getBookmarkManager().updateProperty(hash, name, value);
}

async function inList(hash: string): Promise<string[]> {
	await ensureManagerReady();
	return getBookmarkManager().inList(hash);
}

async function getContent(listName: string): Promise<BookmarkWordEntry[]> {
	await ensureManagerReady();
	return getBookmarkManager().getListContent(listName);
}

async function getEmptyLists(): Promise<string[]> {
	await ensureManagerReady();
	return getBookmarkManager().getEmptyLists();
}

async function getWordByHash(hash: string): Promise<BookmarkWordEntry | undefined> {
	await ensureManagerReady();
	return getBookmarkManager().getWordByHash(hash);
}

export const bookmarksStore = {
	get lists(): string[] {
		return lists;
	},
	get initialized(): boolean {
		return initialized;
	},
	refresh,
	createList,
	deleteList,
	addToList,
	removeFromList,
	updateProperty,
	inList,
	getContent,
	getEmptyLists,
	getWordByHash,
};
