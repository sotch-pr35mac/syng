import type { SearchEntry } from '../types/search.js';

/**
 * App-lifetime store for the word currently displayed in the mobile character window
 * (MobileCharacters.svelte). Kept separate from searchStore.activeWord because the
 * character window can be launched from anywhere in the app — search, bookmarks, study —
 * not just from the search flow.
 */
let mobileCharacterWindowWord = $state<SearchEntry | undefined>(undefined);

export const mobileCharacterWindowWordStore = {
	get value() {
		return mobileCharacterWindowWord;
	},
	set(word: SearchEntry) {
		mobileCharacterWindowWord = word;
	},
};
