import { invoke } from '@tauri-apps/api/core';
import { handleError } from '@/utils/error.js';
import { telemetry } from '@/utils/telemetry.js';
import {
	LANG_COMMANDS,
	SEARCH_LANGS,
	searchResultKeys,
	type SearchEntry,
	type SearchLang,
} from '@/types/search.js';
import { bookmarksStore } from '@/stores/bookmarks.svelte.js';
import { NATIVE_COMMANDS } from '@/types/nativeCommands.js';
import type { QueryTrigger, SearchQueryTelemetry } from '@/types/telemetry.js';
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
// Lexical IDs alone cannot identify a selected occurrence in repeated query results.
let activeResultKey = $state<string | null>(null);
let searchTrackDebounce: ReturnType<typeof setTimeout> | undefined;
interface QueryRequest {
	text: string;
	mode: 'auto' | 'manual';
	language: SearchLang | null;
	id: string;
	ready: boolean;
	emitted: boolean;
	trigger?: QueryTrigger;
	resultCount: number | null;
	outcome: 'success' | 'error';
}
let currentRequest: QueryRequest | undefined;
let displayedRequest: QueryRequest | undefined;
let queryText = $state('');
let popoverRequest = 0;
const searchHistory = $state<SearchEntry[]>([]);
let historyPosition = $state(-1);
let popoverResults = $state<SearchEntry[]>([]);
let popoverResultIndex = $state(0);
let popoverWord = $state<SearchEntry | undefined>(undefined);
let popoverAnchor = $state<DOMRect | undefined>(undefined);

/** Classifies the input language and queries the dictionary, updating fullResults and searchLang. */
function commitQuery(request: QueryRequest | undefined, trigger: QueryTrigger): void {
	if (!request || request.emitted) {
		return;
	}
	if (!request.trigger || trigger !== 'pause') {
		request.trigger = trigger;
	}
	if (!request.ready) {
		return;
	}
	request.emitted = true;
	const payload: SearchQueryTelemetry = {
		query_id: request.id,
		term_length: Array.from(request.text).length,
		search_language: request.language,
		language_mode: request.mode,
		result_count: request.resultCount,
		outcome: request.outcome,
		trigger: request.trigger,
	};
	telemetry.trackEvent('search.query', payload).catch(() => {});
}

function cancelPendingTelemetry(): void {
	clearTimeout(searchTrackDebounce);
	searchTrackDebounce = undefined;
	if (currentRequest?.trigger === 'pause') {
		currentRequest.trigger = undefined;
	}
}

function runSearch(rawText: string, language?: SearchLang): void {
	queryText = rawText;
	const text = rawText.trim();
	const mode = language ? 'manual' : 'auto';
	if (
		currentRequest?.text === text &&
		currentRequest.mode === mode &&
		(mode === 'auto' || currentRequest.language === language)
	) {
		return;
	}
	cancelPendingTelemetry();
	if (!text) {
		currentRequest = undefined;
		displayedRequest = undefined;
		fullResults = [];
		return;
	}
	const request: QueryRequest = {
		text,
		mode,
		language: language ?? null,
		id: crypto.randomUUID(),
		ready: false,
		emitted: false,
		resultCount: null,
		outcome: 'success',
	};
	currentRequest = request;
	searchTrackDebounce = setTimeout(() => commitQuery(request, 'pause'), SEARCH_TRACK_DEBOUNCE_MS);
	const classification = language
		? Promise.resolve(language)
		: invoke<SearchLang>(NATIVE_COMMANDS.DICTIONARY.CLASSIFY, { text });
	const query = invoke<SearchEntry[]>(
		language ? LANG_COMMANDS[language] : NATIVE_COMMANDS.DICTIONARY.QUERY,
		{ text }
	);
	void Promise.allSettled([classification, query]).then(([classified, queried]) => {
		request.language =
			classified.status === 'fulfilled' && SEARCH_LANGS.includes(classified.value)
				? classified.value
				: null;
		request.ready = true;
		request.resultCount = queried.status === 'fulfilled' ? queried.value.length : null;
		request.outcome = queried.status === 'fulfilled' ? 'success' : 'error';
		if (currentRequest !== request) {
			if (request.trigger === 'submit') {
				commitQuery(request, 'submit');
			}
			return undefined;
		}
		if (request.language) {
			searchLang = request.language;
		}
		if (queried.status === 'fulfilled') {
			fullResults = queried.value;
			request.resultCount = queried.value.length;
			displayedRequest = request;
		} else {
			fullResults = [];
			displayedRequest = undefined;
			request.outcome = 'error';
			handleError('Search failed.', queried.reason, {
				privateValues: [request.text],
				context: { operation: 'dictionary.search', stage: 'query' },
			});
		}
		if (request.trigger) {
			commitQuery(request, request.trigger);
		}
		return undefined;
	});
}

function doSearch(text: string): void {
	runSearch(text);
}

/** Queries the dictionary using a specific language command, bypassing auto-classification. */
function doSearchWithLang(text: string, lang: SearchLang): void {
	runSearch(text, lang);
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
	const word = fullResults[index];
	if (!word) {
		return;
	}
	commitQuery(displayedRequest, 'selection');
	activeWord = word;
	activeResultKey = searchResultKeys(fullResults)[index];
	pushHistory(word);
	telemetry
		.trackEvent('dictionary.word_opened', {
			source: 'search',
			interaction: 'result',
			result_position: index + 1,
			result_count: fullResults.length,
			...(displayedRequest
				? { query_id: displayedRequest.id, search_language: displayedRequest.language }
				: {}),
		})
		.catch(() => {});
}

function submitSearch(): void {
	clearTimeout(searchTrackDebounce);
	commitQuery(currentRequest, 'submit');
	if (displayedRequest === currentRequest) {
		selectResult(0);
	}
}

/** Route-owned listeners cancel timers without discarding restored search state. */
function mount(): () => void {
	const onVisibilityChange = () => {
		if (document.visibilityState === 'hidden') {
			cancelPendingTelemetry();
		}
	};
	document.addEventListener('visibilitychange', onVisibilityChange);
	window.addEventListener('pagehide', cancelPendingTelemetry);
	return () => {
		cancelPendingTelemetry();
		document.removeEventListener('visibilitychange', onVisibilityChange);
		window.removeEventListener('pagehide', cancelPendingTelemetry);
	};
}

/** Sets activeWord to an arbitrary entry — used for link following. */
function setActiveWord(word: SearchEntry | undefined): void {
	activeWord = word;
	activeResultKey = null;
}

/**
 * Pushes a word onto the search history, deduplicating by lexical ID so the same entry
 * only ever appears once. Updates historyPosition to point at the new entry.
 */
function pushHistory(word: SearchEntry): void {
	const previousIndex = searchHistory.map((entry) => entry.id).indexOf(word.id);
	if (previousIndex >= 0) {
		searchHistory.splice(previousIndex, 1);
	}
	searchHistory.push(word);
	historyPosition = searchHistory.length - 1;
}

/** Moves back one step in the search history and updates activeWord. */
function historyBack(): void {
	if (!searchHistory[historyPosition - 1]) {
		return;
	}
	historyPosition -= 1;
	setActiveWord(searchHistory[historyPosition]);
	telemetry
		.trackEvent('dictionary.word_opened', { source: 'search', interaction: 'history' })
		.catch(() => {});
}

/** Moves forward one step in the search history and updates activeWord. */
function historyForward(): void {
	if (!searchHistory[historyPosition + 1]) {
		return;
	}
	historyPosition += 1;
	setActiveWord(searchHistory[historyPosition]);
	telemetry
		.trackEvent('dictionary.word_opened', { source: 'search', interaction: 'history' })
		.catch(() => {});
}

async function openPopoverDictionary(text: string, anchor: DOMRect): Promise<void> {
	await lookupPopoverWord({ text, anchor });
}

async function lookupPopoverWord(request: DictionaryLookupRequest): Promise<void> {
	const lookup = normalizeDictionaryLookupRequest(request);
	const requestId = ++popoverRequest;
	try {
		const results = lookup.lexicalId
			? await invoke<SearchEntry | null>(NATIVE_COMMANDS.DICTIONARY.QUERY_BY_ID, {
					id: lookup.lexicalId,
				}).then((unit) => (unit ? [unit] : []))
			: await invoke<SearchEntry[]>(NATIVE_COMMANDS.DICTIONARY.QUERY_BY_CHINESE, {
					text: lookup.text,
				});
		if (requestId !== popoverRequest || !results.length) {
			return;
		}
		const exactMatchIndex = results.findIndex(
			(result) => result.simplified === lookup.text || result.traditional === lookup.text
		);
		popoverResults = results;
		popoverResultIndex = exactMatchIndex >= 0 ? exactMatchIndex : 0;
		popoverWord = popoverResults[popoverResultIndex];
		if (lookup.anchor) {
			popoverAnchor = lookup.anchor;
		}
		telemetry
			.trackEvent('dictionary.word_opened', { source: 'search', interaction: 'link' })
			.catch(() => {});
	} catch (error) {
		handleError('There was an error looking up the dictionary word.', error);
	}
}

function selectPopoverResult(index: number): void {
	if (!popoverResults[index] || index === popoverResultIndex) {
		return;
	}
	popoverResultIndex = index;
	popoverWord = popoverResults[index];
	telemetry
		.trackEvent('dictionary.word_opened', {
			source: 'search',
			interaction: 'popover_result',
			result_position: index + 1,
			result_count: popoverResults.length,
		})
		.catch(() => {});
}

function closePopoverDictionary(): void {
	popoverRequest += 1;
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
	get queryText(): string {
		return queryText;
	},
	get searchLang(): SearchLang {
		return searchLang;
	},
	get fullResults(): SearchEntry[] {
		return fullResults;
	},
	get activeWord(): SearchEntry | undefined {
		return activeWord;
	},
	get activeResultKey(): string | null {
		return activeResultKey;
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
	mount,
	cancelPendingTelemetry,
	submitSearch,
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
