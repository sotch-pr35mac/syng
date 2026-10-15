import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { invoke } from '@tauri-apps/api/core';
import Search from '@/routes/Search.svelte';
import MobileSearch from '@/routes/mobile/MobileSearch.svelte';
import Bookmarks from '@/routes/Bookmarks.svelte';
import MobileBookmarks from '@/routes/mobile/MobileBookmarks.svelte';
import Study from '@/routes/Study.svelte';
import MobileStudy from '@/routes/mobile/MobileStudy.svelte';
import { searchStore } from '@/composables/search.svelte.js';
import { bookmarksRoute } from '@/composables/bookmarks.svelte.js';
import { bookmarksStore, type BookmarkWordEntry } from '@/stores/bookmarks.svelte.js';
import {
	bookmarksActiveListStore,
	bookmarksActiveWordStore,
} from '@/stores/bookmarksRoute.svelte.js';
import { mobileSearchQueryStore, mobileSearchSnapStore } from '@/stores/mobileSearch.svelte.js';
import { mobileBookmarksSnapStore } from '@/stores/mobileBookmarks.svelte.js';
import { studySubRouteStore } from '@/stores/studyRoute.svelte.js';
import { setBookmarkManagerForTest } from '@/utils/appServices.js';
import type { BookmarkListSummary } from '@/types/bookmarks.js';

const device = vi.hoisted(() => ({ mobile: false, ipad: false }));
vi.mock('@/utils/device.js', () => ({
	isAndroid: () => false,
	isMobileLayout: () => device.mobile,
	isMobile: () => device.mobile,
	isIPad: () => device.ipad,
}));
vi.mock('@tauri-apps/plugin-os', () => ({
	platform: () => (device.mobile || device.ipad ? 'ios' : 'macos'),
}));
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('@/utils/error.js', () => ({ handleError: vi.fn() }));
vi.mock('@/utils/telemetry.js', () => ({
	telemetry: { trackEvent: vi.fn(() => Promise.resolve()) },
}));

const word = {
	_id: 'word-1',
	_rev: '1',
	lexical_id: '1:xigua',
	id: '1:xigua',
	traditional: '西瓜',
	simplified: '西瓜',
	english: ['watermelon'],
	pinyin_marks: 'xī guā',
	tone_marks: [1, 1],
	measure_words: [],
	lists: ['Bookmarks'],
	notes: '',
} as unknown as BookmarkWordEntry;
const emptyBookmarks = 'This list is empty. Search for a word, then add it to this list.';
const emptyStudy = 'Add words to a list to start studying.';
const emptySearch = 'No results found. Try another word in Chinese, English, or pinyin.';
const getListContent = vi.fn<() => Promise<BookmarkWordEntry[]>>();
const getListSummaries = vi.fn<() => Promise<BookmarkListSummary[]>>();

beforeEach(async () => {
	vi.clearAllMocks();
	device.mobile = false;
	device.ipad = false;
	vi.mocked(invoke).mockImplementation(async (command) => (command === 'classify' ? 'EN' : []));
	getListContent.mockResolvedValue([]);
	getListSummaries.mockResolvedValue([]);
	setBookmarkManagerForTest({
		waitForInit: () => Promise.resolve(),
		getLists: () => Promise.resolve(['Bookmarks']),
		getListContent,
		getListSummaries,
		inList: () => Promise.resolve(['Bookmarks']),
	} as unknown as Parameters<typeof setBookmarkManagerForTest>[0]);
	searchStore.doSearch('');
	searchStore.setActiveWord(undefined);
	bookmarksActiveListStore.set('Bookmarks');
	bookmarksActiveWordStore.set(undefined);
	studySubRouteStore.set(null);
	mobileSearchQueryStore.set('');
	mobileSearchSnapStore.set('collapsed');
	mobileBookmarksSnapStore.set('collapsed');
	await bookmarksStore.refresh();
	await bookmarksRoute.setActiveList('Bookmarks');
	window.location.hash = '#/';
});

afterEach(() => {
	cleanup();
	searchStore.cancelPendingTelemetry();
});

const surfaces = [
	{
		name: 'desktop',
		search: Search,
		bookmarks: Bookmarks,
		study: Study,
		mobile: false,
		ipad: false,
	},
	{ name: 'iPad', search: Search, bookmarks: Bookmarks, study: Study, mobile: false, ipad: true },
	{
		name: 'mobile',
		search: MobileSearch,
		bookmarks: MobileBookmarks,
		study: MobileStudy,
		mobile: true,
		ipad: false,
	},
];

describe.each(surfaces)('$name empty states', (surface) => {
	beforeEach(() => {
		device.mobile = surface.mobile;
		device.ipad = surface.ipad;
	});

	it('offers Search from an empty list, opening the mobile sheet', async () => {
		window.location.hash = '#/bookmarks';
		const view = render(surface.bookmarks);
		expect(await view.findByText(emptyBookmarks)).toBeTruthy();
		if (surface.mobile) {
			expect(view.getByText(emptyBookmarks).closest('.sy-snap-sheet')).toBeTruthy();
			await waitFor(() => expect(mobileBookmarksSnapStore.value).toBe('partial'));
		}
		await userEvent.click(view.getByRole('button', { name: 'Search for words' }));
		expect(window.location.hash).toBe('#/');
	});

	it('clears a no-match filter without changing list contents or selected details', async () => {
		getListContent.mockResolvedValue([word]);
		await bookmarksRoute.updateListContent();
		const view = render(surface.bookmarks);
		await userEvent.click(await view.findByText('西瓜'));
		const selectedWord = bookmarksRoute.activeWord;
		await fireEvent.input(view.getByPlaceholderText('Filter'), {
			target: { value: 'no-match' },
		});
		expect(await view.findByText('No words match your filter.')).toBeTruthy();
		expect(view.queryByText(emptyBookmarks)).toBeNull();
		await userEvent.click(view.getByRole('button', { name: 'Clear filter' }));
		expect((view.getByPlaceholderText('Filter') as HTMLInputElement).value).toBe('');
		expect(view.queryByText('No words match your filter.')).toBeNull();
		expect(view.container.querySelectorAll('.sy-list-preview-item-container')).toHaveLength(1);
		expect(bookmarksRoute.wordList).toHaveLength(1);
		expect(bookmarksRoute.activeWord).toEqual(selectedWord);
	});

	it('does not describe a loading or failed list as empty', async () => {
		let rejectLoad!: (error: Error) => void;
		getListContent.mockImplementation(
			() =>
				new Promise((_resolve, reject) => {
					rejectLoad = reject;
				})
		);
		const view = render(surface.bookmarks);
		await waitFor(() => expect(bookmarksRoute.contentStatus).toBe('loading'));
		expect(view.queryByText(emptyBookmarks)).toBeNull();
		expect(
			(view.getByRole('button', { name: 'Flashcards' }) as HTMLButtonElement).disabled
		).toBe(true);
		expect((view.getByRole('button', { name: 'Quiz' }) as HTMLButtonElement).disabled).toBe(
			true
		);
		await act(() => rejectLoad(new Error('Storage unavailable')));
		await waitFor(() => expect(bookmarksRoute.contentStatus).toBe('error'));
		expect(view.queryByText(emptyBookmarks)).toBeNull();
		expect(
			(view.getByRole('button', { name: 'Flashcards' }) as HTMLButtonElement).disabled
		).toBe(true);
		expect((view.getByRole('button', { name: 'Quiz' }) as HTMLButtonElement).disabled).toBe(
			true
		);
		expect(view.queryByRole('button', { name: 'Search for words' })).toBeNull();
	});

	it('offers Search from an empty Study picker only after loading', async () => {
		window.location.hash = '#/study';
		let resolveLoad!: (lists: BookmarkListSummary[]) => void;
		getListSummaries.mockImplementation(
			() =>
				new Promise((resolve) => {
					resolveLoad = resolve;
				})
		);
		const view = render(surface.study);
		expect(view.queryByText(emptyStudy)).toBeNull();
		await waitFor(() => expect(resolveLoad).toBeTypeOf('function'));
		await act(() => resolveLoad([]));
		expect(await view.findByText(emptyStudy)).toBeTruthy();
		await userEvent.click(view.getByRole('button', { name: 'Search for words' }));
		expect(window.location.hash).toBe('#/');
	});

	it('keeps failed Study loading separate from an empty picker', async () => {
		getListSummaries.mockRejectedValue(new Error('Storage unavailable'));
		const view = render(surface.study);
		expect(await view.findByText('Unable to load your lists. Please try again.')).toBeTruthy();
		expect(view.queryByText(emptyStudy)).toBeNull();
		expect(view.queryByRole('button', { name: 'Search for words' })).toBeNull();
	});

	it('shows completed zero-result searches in the results area and preserves selected detail', async () => {
		searchStore.setActiveWord(word);
		const view = render(surface.search);
		expect(view.queryByText(emptySearch)).toBeNull();
		let resolveQuery!: (words: BookmarkWordEntry[]) => void;
		vi.mocked(invoke).mockImplementation((command) =>
			command === 'classify'
				? Promise.resolve('EN')
				: new Promise((resolve) => {
						resolveQuery = resolve;
					})
		);
		await act(() => searchStore.doSearch('no-match'));
		expect(view.queryByText(emptySearch)).toBeNull();
		await act(() => resolveQuery([]));
		expect(await view.findByText(emptySearch)).toBeTruthy();
		expect(searchStore.activeWord).toEqual(word);
		if (surface.mobile) {
			expect(view.getByText(emptySearch).closest('.sy-snap-sheet')).toBeTruthy();
			await waitFor(() => expect(mobileSearchSnapStore.value).toBe('partial'));
		}
		await act(() => searchStore.doSearch('  '));
		expect(view.queryByText(emptySearch)).toBeNull();
		vi.mocked(invoke).mockRejectedValue(new Error('Query unavailable'));
		await act(() => searchStore.doSearch('failed'));
		await waitFor(() => expect(searchStore.status).toBe('error'));
		expect(view.queryByText(emptySearch)).toBeNull();
		expect(searchStore.activeWord).toEqual(word);
	});
});
