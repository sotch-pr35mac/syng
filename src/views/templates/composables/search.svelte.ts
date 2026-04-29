import { invoke } from '@tauri-apps/api/core';
import { handleError } from '@/utils/error.js';
import { telemetry } from '@/utils/telemetry.js';
import { LANG_COMMANDS, SEARCH_LANGS, type SearchEntry, type SearchLang } from '@/types/search.js';
import { bookmarksStore } from '@/stores/bookmarks.svelte.js';
import { NATIVE_COMMANDS } from '@/types/nativeCommands.js';

const SEARCH_TRACK_DEBOUNCE_MS = 800;

/**
 * Module-scoped reactive state. Lives for the app session — survives component
 * mount/unmount so Search state is preserved when the user navigates away and returns.
 */
let searchLang = $state<SearchLang>('EN');
let fullResults = $state<SearchEntry[]>([]);
let activeWord = $state<SearchEntry | undefined>(undefined);
let searchTrackDebounce: ReturnType<typeof setTimeout>;
const searchHistory = $state<SearchEntry[]>([]);
let historyPosition = $state(-1);

/** Classifies the input language and queries the dictionary, updating fullResults and searchLang. */
function doSearch(text: string): void {
	if (!text.trim()) {
		fullResults = [];
		return;
	}
	clearTimeout(searchTrackDebounce);
	searchTrackDebounce = setTimeout(() => {
		telemetry.trackEvent('search.query', { term_length: text.length }).catch(() => {});
	}, SEARCH_TRACK_DEBOUNCE_MS);
	invoke<SearchLang>(NATIVE_COMMANDS.DICTIONARY.CLASSIFY, { text })
		.then((result) => {
			searchLang = result;
			return undefined;
		})
		.catch(() => {});
	invoke<SearchEntry[]>(NATIVE_COMMANDS.DICTIONARY.QUERY, { text })
		.then((results) => {
			fullResults = results;
			return undefined;
		})
		.catch((error) => handleError('Search failed.', error));
}

/** Queries the dictionary using a specific language command, bypassing auto-classification. */
function doSearchWithLang(text: string, lang: SearchLang): void {
	invoke<SearchEntry[]>(LANG_COMMANDS[lang], { text })
		.then((results) => {
			fullResults = results;
			return undefined;
		})
		.catch(() => {});
}

/** Advances searchLang to the next value in the cycle and re-runs the current query. */
function switchLang(currentQuery: string): void {
	const nextIndex = (SEARCH_LANGS.indexOf(searchLang) + 1) % SEARCH_LANGS.length;
	searchLang = SEARCH_LANGS[nextIndex];
	if (currentQuery) {
		doSearchWithLang(currentQuery, searchLang);
	}
}

/** Sets activeWord to the entry at the given index in fullResults. */
function selectResult(index: number): void {
	activeWord = fullResults[index];
}

/** Sets activeWord to an arbitrary entry — used for link following. */
function setActiveWord(word: SearchEntry): void {
	activeWord = word;
}

/**
 * Pushes a word onto the search history, deduplicating by word_id so the same entry
 * only ever appears once. Updates historyPosition to point at the new entry.
 */
function pushHistory(word: SearchEntry): void {
	const previousIndex = searchHistory.map((entry) => entry.word_id).indexOf(word.word_id);
	if (previousIndex >= 0) {
		searchHistory.splice(previousIndex, 1);
		historyPosition -= 1;
	}
	searchHistory.push(word);
	historyPosition += 1;
}

/** Moves back one step in the search history and updates activeWord. */
function historyBack(): void {
	historyPosition -= 1;
	activeWord = searchHistory[historyPosition];
}

/** Moves forward one step in the search history and updates activeWord. */
function historyForward(): void {
	historyPosition += 1;
	activeWord = searchHistory[historyPosition];
}

/**
 * Singleton search store. Both desktop Search and MobileSearch consume this same instance
 * so state is preserved across navigation for the lifetime of the app session.
 */
export const searchStore = {
	get searchLang(): SearchLang {
		return searchLang;
	},
	get fullResults(): SearchEntry[] {
		return fullResults;
	},
	get activeWord(): SearchEntry | undefined {
		return activeWord;
	},
	get bookmarks(): string[] {
		// Reads from the shared bookmarks store — always reflects the latest list of
		// lists without any per-component fetch.
		return bookmarksStore.lists;
	},
	get canGoBack(): boolean {
		return searchHistory[historyPosition - 1] !== undefined;
	},
	get canGoForward(): boolean {
		return searchHistory[historyPosition + 1] !== undefined;
	},
	doSearch,
	doSearchWithLang,
	switchLang,
	selectResult,
	setActiveWord,
	pushHistory,
	historyBack,
	historyForward,
};
