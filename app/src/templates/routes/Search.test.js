/* eslint-disable no-undef */
import Search from './Search.svelte';
import { render } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { wait, mockDictionary } from '../../../test/utils/unitTestUtils.js';

global.dictionary = mockDictionary('EN', [{
	traditional: '西瓜', 
	simplified: '西瓜', 
	english: ['watermelon'], 
	pinyinMarks: [1, 1]
}]);

it('should update the language selection after entering text to the search bar', async () => {
	const { getByPlaceholderText, getByText } = render(Search, {});
	userEvent.type(getByPlaceholderText('Search...'), 'watermelon');
	expect(getByText('EN')).toBeTruthy();
});
it('should re-search after clicking the language selector', async () => {
	const { getByPlaceholderText, getByText } = render(Search, {});
	userEvent.type(getByPlaceholderText('Search...'), 'watermelon');
	expect(getByText('EN')).toBeTruthy();

	userEvent.click(getByText('EN'));
	wait(() => {
		expect(getByText('PY')).toBeTruthy();
		expect(global.dictionary.queryByPinyin).toHaveBeenCalled();
	});
});
it('should populate the search result list after a query', async () => {
	const updateSearchResults = jest.fn(); //eslint-disable-line no-unused-vars
	const { getByPlaceholderText, getByText } = render(Search, {});
	userEvent.type(getByPlaceholderText('Search...'), 'watermelon');
	wait(() => {
		const searchResultItemClasses = getByText('西瓜').className.split(' ');
		expect(searchResultItemClasses).toContain('sy-list-preview-item--headline');
	});
});
it('should display word details after clicking on the search result', async () => {
	const { getByPlaceholderText, getByText } = render(Search, {});
	userEvent.type(getByPlaceholderText('Search...'), 'watermelon');
	wait(() => {
		userEvent.click(getByText('西瓜'));
		wait(() => {
			expect(getByText('Definitions')).toBeTruthy();
		});
	});
});
