/* eslint-disable no-undef */
import Search from './Search.svelte';
import { render } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { mockGlobalTauri, mockDictionary, mockPreferenceManager, mockBookmarkManager } from '../../../test/utils/unitTestUtils.js';

global.dictionary = mockDictionary('EN', [{
	traditional: '西瓜', 
	simplified: '西瓜', 
	english: ['watermelon'], 
	toneMarks: [1, 1],
	measureWords: [{ simplified: 'MWA', traditional: 'MWA' }]
}]);
const QUERY_RESULTS = [{
	traditional: '西瓜', 
	simplified: '西瓜', 
	english: ['watermelon'], 
	tone_marks: [1, 1],
	measure_words: [{ simplified: 'MWA', traditional: 'MWA' }]

}];
global.preferenceManager = mockPreferenceManager({
	transparency: process.platform === 'darwin'
});
global.bookmarkManager = mockBookmarkManager({
	words: [],
	lists: ['Bookmarks']
});
global.__TAURI__ = mockGlobalTauri({
	invoke: {
		classify: value => 'EN', // eslint-disable-line no-unused-vars
		query: value => QUERY_RESULTS, // eslint-disable-line no-unused-vars
		query_by_english: value => QUERY_RESULTS, // eslint-disable-line no-unused-vars
		query_by_pinyin: value => QUERY_RESULTS, // eslint-disable-line no-unused-vars
		query_by_chinese: value => QUERY_RESULTS // eslint-disable-line no-unused-vars
	}
});

it('should update the language selection after entering text to the search bar', async () => {
	const user = userEvent.setup();
	const { getByPlaceholderText, getByText } = render(Search, {});
	await user.type(getByPlaceholderText('Search...'), 'watermelon');
	expect(getByText('EN')).toBeTruthy();
});
it('should re-search after clicking the language selector', async () => {
	const user = userEvent.setup();
	const { getByText } = render(Search, {});
	expect(getByText('EN')).toBeTruthy();

	await user.click(getByText('EN'));
	expect(getByText('PY')).toBeTruthy();
});
it('should populate the search result list after a query', async () => {
	const user = userEvent.setup();
	const updateSearchResults = jest.fn(); // eslint-disable-line no-unused-vars
	const { getByPlaceholderText, getByText } = render(Search, {});
	await user.type(getByPlaceholderText('Search...'), 'watermelon');
	const searchResultItemClasses = getByText('西瓜').className.split(' ');
	expect(searchResultItemClasses).toContain('sy-list-preview-item--headline');
});
it('should display word details after clicking on the search result', async () => {
	const user = userEvent.setup();
	const { getByPlaceholderText, getByText } = render(Search, {});
	await user.type(getByPlaceholderText('Search...'), 'watermelon');
	await user.click(getByText('西瓜'));
	expect(getByText('Definitions')).toBeTruthy();
});
it('should display measure words when present in the results', async () => {
	const user = userEvent.setup();
	const { getByPlaceholderText, getByText } = render(Search, {});
	await user.type(getByPlaceholderText('Search...'), 'watermelon');
	await user.click(getByText('西瓜'));
	expect(getByText('Measure Words')).toBeTruthy();
});
