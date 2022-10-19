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
	const query = jest.fn().mockReturnValue(new Promise((res, rej) => {
		res(entries);
	}));
	return {
		classify: param => new Promise((res, rej) => res(lang)),
		query,
		queryByPinyin: query,
		queryByEnglish: query,
		queryByChinese: query
	};
};

export const mockPreferenceManager = store => {
	return {
		get: name => store[name],
		set: (name, value) => undefined
	};
};

export const mockGlobalTauri = options => {
	return {
		invoke: (fnName, value) => {
			return new Promise((res, rej) => {
				res(options.invoke[fnName](value));
			});
		},
		os: {
			platform: () => new Promise((res, rej) => res(options.platform || 'other'))
		},
		event: {
			listen: (e, cb) => wait(() => cb({ payload: options.events[e] }))
		}
	};
};
