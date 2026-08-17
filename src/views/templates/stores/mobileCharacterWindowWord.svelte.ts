import type { SearchEntry } from '@/types/search.js';
import type { CharacterScript } from '@/types/dictionaryDisplay.js';

/**
 * App-lifetime store for the word and optional initial script used by the mobile character
 * window (MobileCharacters.svelte). Kept separate from searchStore.activeWord because the
 * character window can be launched from anywhere in the app — search, bookmarks, study —
 * not just from the search flow.
 */
let mobileCharacterWindowWord = $state<SearchEntry | undefined>(undefined);
let mobileCharacterWindowInitialScript = $state<CharacterScript | undefined>(undefined);

export const mobileCharacterWindowWordStore = {
	get value() {
		return mobileCharacterWindowWord;
	},
	get initialScript() {
		return mobileCharacterWindowInitialScript;
	},
	set(word: SearchEntry | undefined, initialScript?: CharacterScript) {
		mobileCharacterWindowWord = word;
		mobileCharacterWindowInitialScript = initialScript;
	},
};
