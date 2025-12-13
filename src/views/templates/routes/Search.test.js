/* eslint-disable no-undef */
import { vi } from 'vitest';
import { render } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { mockBookmarkManager, mockDictionary, mockPreferenceManager } from '../../../test/utils/unitTestUtils.js';
import Search from './Search.svelte';

// Mock must be defined inline because vi.mock is hoisted before imports
vi.mock('lucide-svelte', async () => {
	const mockIcon = (await import('../components/__mocks__/FeatherIcon.svelte')).default;
	return {
		ChevronLeft: mockIcon,
		ChevronRight: mockIcon,
		Plus: mockIcon,
		Check: mockIcon,
		Brush: mockIcon,
	};
});

// Mock @tauri-apps/plugin-os
vi.mock('@tauri-apps/plugin-os', () => ({
	platform: () => 'macos'
}));

const QUERY_RESULTS = [{
	traditional: '西瓜',
	simplified: '西瓜',
	english: ['watermelon'],
	pinyin_marks: ['xī', 'guā'],
	tone_marks: [1, 1],
	measure_words: [{ simplified: 'MWA', traditional: 'MWA' }]
}];

// Mock @tauri-apps/api/core
vi.mock('@tauri-apps/api/core', () => ({
	invoke: vi.fn((cmd) => {
		switch (cmd) {
			case 'classify':
				return Promise.resolve('EN');
			case 'query':
			case 'query_by_english':
			case 'query_by_pinyin':
			case 'query_by_chinese':
				return Promise.resolve(QUERY_RESULTS);
			default:
				return Promise.resolve(null);
		}
	})
}));

global.dictionary = mockDictionary('EN', [{
	traditional: '西瓜',
	simplified: '西瓜',
	english: ['watermelon'],
	toneMarks: [1, 1],
	measureWords: [{ simplified: 'MWA', traditional: 'MWA' }]
}]);
global.preferenceManager = mockPreferenceManager({
	transparency: process.platform === 'darwin'
});
global.bookmarkManager = mockBookmarkManager({
	words: [],
	lists: ['Bookmarks']
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
	const updateSearchResults = vi.fn(); // eslint-disable-line no-unused-vars
	const { getByPlaceholderText, getByText } = render(Search, {});
	await user.type(getByPlaceholderText('Search...'), 'watermelon');
	const searchResultItemClasses = getByText('西瓜').className.split(' ');
	expect(searchResultItemClasses).toContain('sy-list-preview-item--headline');
});
it('should display word details after clicking on the search result', async () => {
	const user = userEvent.setup();
	const { getByPlaceholderText, findByText } = render(Search, {});
	await user.type(getByPlaceholderText('Search...'), 'watermelon');
	await user.click(await findByText('西瓜'));
	expect(await findByText('Definitions')).toBeTruthy();
});
it('should display measure words when present in the results', async () => {
	const user = userEvent.setup();
	const { getByPlaceholderText, findByText } = render(Search, {});
	await user.type(getByPlaceholderText('Search...'), 'watermelon');
	await user.click(await findByText('西瓜'));
	expect(await findByText('Measure Words')).toBeTruthy();
});