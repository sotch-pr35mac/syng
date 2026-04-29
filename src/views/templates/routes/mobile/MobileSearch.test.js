import { beforeEach, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { mockBookmarkManager } from '@test/utils/unitTestUtils.js';
import MobileSearch from '@/routes/mobile/MobileSearch.svelte';
import { mobileSearchSnapStore } from '@/stores/mobileSearch.svelte.js';
import { setBookmarkManagerForTest } from '@/utils/appServices.js';

vi.mock('lucide-svelte', async () => {
	const mockIcon = (await import('@/components/__mocks__/FeatherIcon.svelte')).default;
	return {
		Check: mockIcon,
		Brush: mockIcon,
		Plus: mockIcon,
	};
});

vi.mock('@tauri-apps/plugin-os', () => ({
	platform: () => 'ios',
	version: () => Promise.resolve('18.0'),
}));

const QUERY_RESULTS = [
	{
		word_id: 1,
		hash: 'xigua',
		traditional: '西瓜',
		simplified: '西瓜',
		english: ['watermelon'],
		pinyin_marks: 'xī guā',
		tone_marks: [1, 1],
		measure_words: [{ simplified: 'MWA', traditional: 'MWA' }],
	},
];

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
	}),
}));

const bookmarkManager = mockBookmarkManager({
	words: [],
	lists: ['Bookmarks'],
});
bookmarkManager.waitForInit = () => Promise.resolve();
setBookmarkManagerForTest(bookmarkManager);

beforeEach(() => {
	mobileSearchSnapStore.set('collapsed');
});

it('should render the search input', () => {
	const { getByPlaceholderText } = render(MobileSearch);
	expect(getByPlaceholderText('Search...')).toBeTruthy();
});

it('should display the current search language', () => {
	const { getByText } = render(MobileSearch);
	expect(getByText('EN')).toBeTruthy();
});

it('should cycle the language after clicking the language selector', async () => {
	const user = userEvent.setup();
	const { getByText } = render(MobileSearch);
	await user.click(getByText('EN'));
	expect(getByText('PY')).toBeTruthy();
});

it('should populate the result list after a query', async () => {
	const user = userEvent.setup();
	const { getByPlaceholderText, getByText } = render(MobileSearch);
	await user.type(getByPlaceholderText('Search...'), 'watermelon');
	const headline = getByText('西瓜');
	expect(headline.className.split(' ')).toContain('sy-list-preview-item--headline');
});

it('should display word details after clicking a search result', async () => {
	const user = userEvent.setup();
	const { getByPlaceholderText, findByText } = render(MobileSearch);
	await user.type(getByPlaceholderText('Search...'), 'watermelon');
	await user.click(await findByText('西瓜'));
	expect(await findByText('Definitions')).toBeTruthy();
});

it('should open the snap sheet to partial after focusing the search input', async () => {
	const user = userEvent.setup();
	const { getByPlaceholderText } = render(MobileSearch);

	await user.click(getByPlaceholderText('Search...'));

	expect(mobileSearchSnapStore.value).toBe('partial');
});

it('should collapse the snap sheet after clicking a search result', async () => {
	const user = userEvent.setup();
	mobileSearchSnapStore.set('full');
	const { getByPlaceholderText, findByText } = render(MobileSearch);

	await user.type(getByPlaceholderText('Search...'), 'watermelon');
	await user.click(await findByText('西瓜'));

	expect(mobileSearchSnapStore.value).toBe('collapsed');
});

it('should display measure words when present in the result', async () => {
	const user = userEvent.setup();
	const { getByPlaceholderText, findByText } = render(MobileSearch);
	await user.type(getByPlaceholderText('Search...'), 'watermelon');
	await user.click(await findByText('西瓜'));
	expect(await findByText('Measure Words')).toBeTruthy();
});
