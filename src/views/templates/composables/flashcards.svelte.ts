import { bookmarksStore, type BookmarkWordEntry } from '@/stores/bookmarks.svelte.js';
import {
	flashcardsActiveIndexStore,
	flashcardsActiveListStore,
	flashcardsShowDetailsStore,
} from '@/stores/flashcards.svelte.js';
import { studySubRouteStore } from '@/stores/studyRoute.svelte.js';
import { handleError } from '@/utils/index.js';

let flashcardsActiveList = $state<string | null>(flashcardsActiveListStore.value);
let flashcardsActiveIndex = $state(flashcardsActiveIndexStore.value);
let flashcardsShowDetails = $state(flashcardsShowDetailsStore.value);
let flashcardsListContent = $state<BookmarkWordEntry[]>([]);
let flashcardsLoading = $state(true);

function loadFlashcards(listFromUrl: string | null): void {
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
			flashcardsListContent = contents;
			if (flashcardsActiveIndex > Math.max(contents.length - 1, 0)) {
				flashcardsActiveIndex = Math.max(contents.length - 1, 0);
			}
			flashcardsLoading = false;
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
	studySubRouteStore.set(null);
	flashcardsActiveIndexStore.set(0);
	flashcardsShowDetailsStore.set(false);
	window.location.hash = '#/study';
}

function previousFlashcard(): void {
	if (flashcardsActiveIndex > 0) {
		flashcardsActiveIndex -= 1;
		persistFlashcardsIndex();
	}
}

function nextFlashcard(): void {
	if (flashcardsActiveIndex < flashcardsListContent.length - 1) {
		flashcardsActiveIndex += 1;
		persistFlashcardsIndex();
	}
}

function flipFlashcard(): void {
	flashcardsShowDetails = !flashcardsShowDetails;
	persistFlashcardsDetails();
}

export const flashcardsRoute = {
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
	load: loadFlashcards,
	persistIndex: persistFlashcardsIndex,
	persistDetails: persistFlashcardsDetails,
	exit: exitFlashcards,
	previous: previousFlashcard,
	next: nextFlashcard,
	flip: flipFlashcard,
};
