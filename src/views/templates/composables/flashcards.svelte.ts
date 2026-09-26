import { bookmarksStore, type BookmarkWordEntry } from '@/stores/bookmarks.svelte.js';
import {
	flashcardsActiveIndexStore,
	flashcardsActiveListStore,
	flashcardsShowDetailsStore,
} from '@/stores/flashcards.svelte.js';
import { studySubRouteStore } from '@/stores/studyRoute.svelte.js';
import { handleError, telemetry } from '@/utils/index.js';
import { createDictionaryPopover } from '@/composables/dictionaryPopover.svelte.js';
import type { SearchEntry } from '@/types/search.js';

let flashcardsActiveList = $state<string | null>(flashcardsActiveListStore.value);
let flashcardsActiveIndex = $state(flashcardsActiveIndexStore.value);
let flashcardsShowDetails = $state(flashcardsShowDetailsStore.value);
let flashcardsListContent = $state<BookmarkWordEntry[]>([]);
let flashcardsLoading = $state(true);
// Dictionary popover for cross-reference links (e.g. measure words) tapped inside the
// flashcard's DictionaryContent. Shared with quiz via createDictionaryPopover.
const popover = createDictionaryPopover('flashcards');
let loadRequest = 0;
let sessionActive = false;
// eslint-disable-next-line svelte/prefer-svelte-reactivity -- Analytics counters do not drive UI.
const viewedCards = new Set<number>();
// eslint-disable-next-line svelte/prefer-svelte-reactivity -- Analytics counters do not drive UI.
const revealedCards = new Set<number>();

function endSession(): void {
	loadRequest += 1;
	popover.close();
	if (!sessionActive) {
		return;
	}
	sessionActive = false;
	telemetry
		.trackEvent('flashcards.session_ended', {
			viewed_count: viewedCards.size,
			revealed_count: revealedCards.size,
		})
		.catch(() => {});
	viewedCards.clear();
	revealedCards.clear();
}

function loadFlashcards(listFromUrl: string | null): void {
	endSession();
	const requestId = ++loadRequest;
	const storedList = flashcardsActiveListStore.value;
	const storedIndex = flashcardsActiveIndexStore.value;
	const storedShowDetails = flashcardsShowDetailsStore.value;
	const isRestoringSession = !listFromUrl || listFromUrl === storedList;

	flashcardsActiveList = listFromUrl ?? storedList;
	flashcardsActiveIndex = isRestoringSession ? storedIndex : 0;
	flashcardsShowDetails = isRestoringSession ? storedShowDetails : false;
	flashcardsListContent = [];
	flashcardsLoading = true;

	if (listFromUrl) {
		flashcardsActiveListStore.set(listFromUrl);
	}

	studySubRouteStore.set('flashcards');

	if (!flashcardsActiveList) {
		flashcardsLoading = false;
		return;
	}

	bookmarksStore
		.getContent(flashcardsActiveList)
		.then((contents) => {
			if (requestId !== loadRequest) {
				return undefined;
			}
			flashcardsListContent = contents;
			if (flashcardsActiveIndex > Math.max(contents.length - 1, 0)) {
				flashcardsActiveIndex = Math.max(contents.length - 1, 0);
			}
			flashcardsLoading = false;
			if (contents.length) {
				sessionActive = true;
				viewedCards.add(flashcardsActiveIndex);
				if (flashcardsShowDetails) {
					revealedCards.add(flashcardsActiveIndex);
				}
				telemetry
					.trackEvent('flashcards.started', { word_count: contents.length })
					.catch(() => {});
			}
			return undefined;
		})
		.catch((error) => {
			handleError(
				'There was an error fetching list content. Check the log for more details.',
				error
			);
		});
}

function persistFlashcardsIndex(): void {
	flashcardsActiveIndexStore.set(flashcardsActiveIndex);
	flashcardsShowDetails = false;
}

function persistFlashcardsDetails(): void {
	flashcardsShowDetailsStore.set(flashcardsShowDetails);
}

function exitFlashcards(): void {
	endSession();
	studySubRouteStore.set(null);
	flashcardsActiveIndexStore.set(0);
	flashcardsShowDetailsStore.set(false);
	window.location.hash = '#/study';
}

function previousFlashcard(): void {
	if (flashcardsActiveIndex > 0) {
		flashcardsActiveIndex -= 1;
		if (sessionActive) {
			viewedCards.add(flashcardsActiveIndex);
		}
		persistFlashcardsIndex();
	}
}

function nextFlashcard(): void {
	if (flashcardsActiveIndex < flashcardsListContent.length - 1) {
		flashcardsActiveIndex += 1;
		if (sessionActive) {
			viewedCards.add(flashcardsActiveIndex);
		}
		persistFlashcardsIndex();
	}
}

function flipFlashcard(): void {
	flashcardsShowDetails = !flashcardsShowDetails;
	if (sessionActive && flashcardsShowDetails) {
		revealedCards.add(flashcardsActiveIndex);
	}
	persistFlashcardsDetails();
}

export const flashcardsRoute = {
	endSession,
	get activeList(): string | null {
		return flashcardsActiveList;
	},
	get activeIndex(): number {
		return flashcardsActiveIndex;
	},
	get showDetails(): boolean {
		return flashcardsShowDetails;
	},
	get listContent(): BookmarkWordEntry[] {
		return flashcardsListContent;
	},
	get activeWord(): BookmarkWordEntry | undefined {
		return flashcardsListContent[flashcardsActiveIndex];
	},
	get loading(): boolean {
		return flashcardsLoading;
	},
	get lists(): string[] {
		return bookmarksStore.lists;
	},
	get canGoPrevious(): boolean {
		return flashcardsActiveIndex > 0;
	},
	get canGoNext(): boolean {
		return flashcardsActiveIndex < flashcardsListContent.length - 1;
	},
	get popoverWord(): SearchEntry | undefined {
		return popover.word;
	},
	get popoverResults(): SearchEntry[] {
		return popover.results;
	},
	get popoverResultIndex(): number {
		return popover.resultIndex;
	},
	get popoverReopenKey(): number {
		return popover.reopenKey;
	},
	get popoverAnchor(): DOMRect | undefined {
		return popover.anchor;
	},
	load: loadFlashcards,
	persistIndex: persistFlashcardsIndex,
	persistDetails: persistFlashcardsDetails,
	exit: exitFlashcards,
	previous: previousFlashcard,
	next: nextFlashcard,
	flip: flipFlashcard,
	lookupPopoverWord: popover.lookup,
	selectPopoverResult: popover.select,
	closePopoverDictionary: popover.close,
};
