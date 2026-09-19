import { vi } from 'vitest';
import { render, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import {
	mockBookmarkManager,
	mockDictionary,
	mockPreferenceManager,
} from '@test/utils/unitTestUtils.js';
import Search from '@/routes/Search.svelte';
import { setBookmarkManagerForTest, setPreferenceManagerForTest } from '@/utils/appServices.js';

// Mock must be defined inline because vi.mock is hoisted before imports
vi.mock('lucide-svelte', async () => {
	const mockIcon = (await import('@/components/__mocks__/FeatherIcon.svelte')).default;
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
	platform: () => 'macos',
}));

const QUERY_RESULTS = [
	{
		id: '1:test-watermelon',
		traditional: '西瓜',
		simplified: '西瓜',
		english: ['watermelon'],
		pinyin_marks: ['xī', 'guā'],
		tone_marks: [1, 1],
		measure_words: [{ simplified: 'MWA', traditional: 'MWA' }],
	},
];
const REORDER_RESULTS = [
	QUERY_RESULTS[0],
	{
		id: '1:test-banana',
		traditional: '香蕉',
		simplified: '香蕉',
		english: ['banana'],
		pinyin_marks: ['xiāng', 'jiāo'],
		tone_marks: [1, 1],
		measure_words: [{ simplified: 'MWB', traditional: 'MWB' }],
	},
];

// Mock @tauri-apps/api/core
vi.mock('@tauri-apps/api/core', () => ({
	invoke: vi.fn((cmd, args) => {
		if (args?.text === 'reorder' && cmd === 'query') {
			return Promise.resolve(REORDER_RESULTS);
		}
		if (
			args?.text === 'reorder' &&
			['query_by_english', 'query_by_pinyin', 'query_by_chinese'].includes(cmd)
		) {
			return Promise.resolve([...REORDER_RESULTS].reverse());
		}
		if (cmd === 'query' && args?.text?.length > 10) {
			return Promise.resolve([QUERY_RESULTS[0], { ...QUERY_RESULTS[0] }]);
		}
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
	}),
}));

global.dictionary = mockDictionary('EN', [
	{
		traditional: '西瓜',
		simplified: '西瓜',
		english: ['watermelon'],
		toneMarks: [1, 1],
		measureWords: [{ simplified: 'MWA', traditional: 'MWA' }],
	},
]);
setPreferenceManagerForTest(mockPreferenceManager({}));
setBookmarkManagerForTest(
	mockBookmarkManager({
		words: [],
		lists: ['Bookmarks'],
	})
);

it('should auto-focus the search field on mount', () => {
	const { getByPlaceholderText } = render(Search, {});
	expect(getByPlaceholderText('Search...')).toBe(document.activeElement);
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
	const searchResultItemClasses = getByText('西瓜')
		.closest('.sy-list-preview-item--headline')
		.className.split(' ');
	expect(searchResultItemClasses).toContain('sy-list-preview-item--headline');
});
it('should preserve repeated entries from a long query with unique result keys', async () => {
	const user = userEvent.setup();
	const { container, getByPlaceholderText, findAllByText } = render(Search, {});
	await user.type(getByPlaceholderText('Search...'), '我的工作聚焦于人与产品、技术的交汇处。');

	expect(await findAllByText('西瓜')).toHaveLength(2);
	expect(container.querySelectorAll('.sy-list-preview__rows > *')).toHaveLength(2);
});
it('should preserve the selected result when result order changes', async () => {
	const user = userEvent.setup();
	const { container, getByPlaceholderText, getByText, findByText } = render(Search, {});
	await user.type(getByPlaceholderText('Search...'), 'reorder');
	await user.click(await findByText('西瓜'));

	await user.click(getByText(/^(EN|PY|ZH)$/));
	await findByText('香蕉');
	await waitFor(() => {
		const activeHeadline = container.querySelector(
			'.sy-list-preview-item-container--active .sy-list-preview-item--headline'
		);
		expect(activeHeadline?.textContent).toContain('西瓜');
	});
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
