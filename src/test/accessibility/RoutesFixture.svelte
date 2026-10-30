<script lang="ts">
	import Bookmarks from '@/routes/Bookmarks.svelte';
	import MobileBookmarks from '@/routes/mobile/MobileBookmarks.svelte';
	import SearchEmptyState from '@/components/Search/SearchEmptyState.svelte';
	import Search from '@/routes/Search.svelte';
	import { searchStore } from '@/composables/search.svelte.js';
	import { mobileBookmarksSnapStore } from '@/stores/mobileBookmarks.svelte.js';
	import type { BookmarkWordEntry } from '@/stores/bookmarks.svelte.js';
	import { setBookmarkManagerForTest } from '@/utils/appServices.js';

	const parameters = new URLSearchParams(location.search);
	const mobile = parameters.has('mobile');
	const showSearch = parameters.has('emptySearch');
	const savedWord = {
		_id: 'word-1',
		_rev: '1',
		lexical_id: '1:xigua',
		traditional: '西瓜',
		simplified: '西瓜',
		english: ['watermelon'],
		pinyin_marks: 'xī guā',
		tone_marks: [1, 1],
		measure_words: [],
		lists: ['Bookmarks'],
		notes: '',
	} as unknown as BookmarkWordEntry;

	setBookmarkManagerForTest({
		waitForInit: async () => undefined,
		getLists: async () => ['Bookmarks'],
		getListContent: async () => (parameters.has('savedWord') ? [savedWord] : []),
	} as unknown as Parameters<typeof setBookmarkManagerForTest>[0]);
	mobileBookmarksSnapStore.set('full');

	if (showSearch) {
		// The browser fixture has no native dictionary; finish a real zero-result query.
		Reflect.set(window, '__TAURI_INTERNALS__', {
			invoke: async (command: string) => (command === 'classify' ? 'EN' : []),
		});
		searchStore.doSearch('no-match');
	}
</script>

<main>
	{#if parameters.has('searchRoute')}
		<Search />
	{:else if showSearch}
		<SearchEmptyState variant={mobile ? 'mobile' : 'desktop'} />
	{:else if mobile}
		<MobileBookmarks />
	{:else}
		<Bookmarks />
	{/if}
</main>

<style>
	main {
		height: 100vh;
	}
</style>
