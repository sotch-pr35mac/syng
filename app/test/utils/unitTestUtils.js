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
