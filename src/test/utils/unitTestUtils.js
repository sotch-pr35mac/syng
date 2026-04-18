import { vi } from 'vitest';
import { act } from '@testing-library/svelte';

// Wait for the DOM after triggering an event before executing subsequent actions
export const wait = act;

/*
* Entries is an array of objects in the following format:
* {
* 	traditional, // String
*	simplified, // String
* 	pinyinMarks, // Array of Numbers
* 	english, // Array of Strings
* }
*/
export const mockDictionary = (lang, entries) => {
	const query = vi.fn().mockReturnValue(Promise.resolve(entries));
	return {
		classify: _param => Promise.resolve(lang),
		query,
		queryByPinyin: query,
		queryByEnglish: query,
		queryByChinese: query
	};
};

export const mockPreferenceManager = store => {
	return {
		get: name => store[name],
		set: (_name, _value) => undefined
	};
};
/*
 * Store should be in the following format:
 * {
 *    words: [{
 *       ...wordEntry, // Word entry object
 *       lists: [] // Array of list names
 *       notes: ''
 *    }], // Array of word entries and list associations
 *    lists: [] // Array of list names
 * }
 */
export const mockBookmarkManager = store => {
	return {
		waitForInit: () => Promise.resolve(),
		getLists: () => Promise.resolve(store.lists),
		inList: hash => {
			const word = store.words.find(w => w.hash === hash);
			return Promise.resolve(word ? word.lists : []);
		},
		getListContent: listName => {
			const words = store.words.filter(w => w.lists.includes(listName));
			return Promise.resolve(words);
		}
	};
};

export const mockGlobalTauri = options => {
	return {
		invoke: (fnName, value) => {
			return Promise.resolve(options.invoke[fnName](value));
		},
		os: {
			platform: () => Promise.resolve(options.platform || 'other')
		},
		event: {
			listen: (e, cb) => wait(() => cb({ payload: options.events[e] }))
		}
	};
};
