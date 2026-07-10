import { invoke } from '@tauri-apps/api/core';
import { handleError } from '@/utils/error.js';
import { telemetry } from '@/utils/telemetry.js';
import { LANG_COMMANDS, SEARCH_LANGS, type SearchEntry, type SearchLang } from '@/types/search.js';
import { bookmarksStore } from '@/stores/bookmarks.svelte.js';
import { NATIVE_COMMANDS } from '@/types/nativeCommands.js';
import {
	normalizeDictionaryLookupRequest,
	type DictionaryLookupRequest,
} from '@/composables/dictionaryPopover.svelte.js';

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
let popoverResults = $state<SearchEntry[]>([]);
let popoverResultIndex = $state(0);
let popoverWord = $state<SearchEntry | undefined>(undefined);
let popoverAnchor = $state<DOMRect | undefined>(undefined);

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

async function openPopoverDictionary(text: string, anchor: DOMRect): Promise<void> {
	try {
		const results = await invoke<SearchEntry[]>(NATIVE_COMMANDS.DICTIONARY.QUERY_BY_CHINESE, {
			text,
		});
		if (!results.length) {
			return;
		}
		const exactMatchIndex = results.findIndex(
			(result) => result.simplified === text || result.traditional === text
		);
		popoverResults = results;
		popoverResultIndex = exactMatchIndex >= 0 ? exactMatchIndex : 0;
		popoverWord = popoverResults[popoverResultIndex];
		popoverAnchor = anchor;
		telemetry.trackEvent('search.dictionary_link_opened', {}).catch(() => {});
	} catch (error) {
		handleError('There was an error looking up the dictionary word.', error);
	}
}

async function lookupPopoverWord(request: DictionaryLookupRequest): Promise<void> {
	const lookup = normalizeDictionaryLookupRequest(request);
	try {
		const results = await invoke<SearchEntry[]>(NATIVE_COMMANDS.DICTIONARY.QUERY_BY_CHINESE, {
			text: lookup.text,
		});
		if (!results.length) {
			return;
		}
		const exactMatchIndex = results.findIndex(
			(result) => result.simplified === lookup.text || result.traditional === lookup.text
		);
		popoverResults = results;
		popoverResultIndex = exactMatchIndex >= 0 ? exactMatchIndex : 0;
		popoverWord = popoverResults[popoverResultIndex];
		telemetry.trackEvent('search.dictionary_link_opened', {}).catch(() => {});
	} catch (error) {
		handleError('There was an error looking up the dictionary word.', error);
	}
}

function selectPopoverResult(index: number): void {
	popoverResultIndex = index;
	popoverWord = popoverResults[index];
}

function closePopoverDictionary(): void {
	popoverWord = undefined;
	popoverResults = [];
	popoverResultIndex = 0;
	popoverAnchor = undefined;
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
	get popoverWord(): SearchEntry | undefined {
		return popoverWord;
	},
	get popoverResults(): SearchEntry[] {
		return popoverResults;
	},
	get popoverResultIndex(): number {
		return popoverResultIndex;
	},
	get popoverAnchor(): DOMRect | undefined {
		return popoverAnchor;
	},
	doSearch,
	doSearchWithLang,
	switchLang,
	selectResult,
	setActiveWord,
	pushHistory,
	historyBack,
	historyForward,
	openPopoverDictionary,
	lookupPopoverWord,
	selectPopoverResult,
	closePopoverDictionary,
};
