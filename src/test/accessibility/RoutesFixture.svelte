<script lang="ts">
	import Bookmarks from '@/routes/Bookmarks.svelte';
	import MobileBookmarks from '@/routes/mobile/MobileBookmarks.svelte';
	import MobileSearch from '@/routes/mobile/MobileSearch.svelte';
	import SearchEmptyState from '@/components/Search/SearchEmptyState.svelte';
	import Search from '@/routes/Search.svelte';
	import Library from '@/routes/Reader/Library.svelte';
	import Study from '@/routes/Study.svelte';
	import { searchStore } from '@/composables/search.svelte.js';
	import { mobileBookmarksSnapStore } from '@/stores/mobileBookmarks.svelte.js';
	import type { BookmarkWordEntry } from '@/stores/bookmarks.svelte.js';
	import {
		setBookmarkManagerForTest,
		setReaderDocumentManagerForTest,
	} from '@/utils/appServices.js';

	const parameters = new URLSearchParams(location.search);
	const mobile = parameters.has('mobile');
	const showSearch = parameters.has('emptySearch') || parameters.has('selectedSearch');
	let compactSheetHeader = $state(false);
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
	const selectedWord = { ...savedWord, english: ['watermelon', 'melon'] };

	setBookmarkManagerForTest({
		waitForInit: async () => undefined,
		getLists: async () => ['Bookmarks'],
		getListContent: async () => (parameters.has('savedWord') ? [savedWord] : []),
		getListSummaries: async () => [{ name: 'Sample words', wordCount: 5 }],
		inList: async () => [],
	} as unknown as Parameters<typeof setBookmarkManagerForTest>[0]);
	setReaderDocumentManagerForTest({
		waitForInit: async () => undefined,
		getDocuments: async () => [],
	} as unknown as Parameters<typeof setReaderDocumentManagerForTest>[0]);
	mobileBookmarksSnapStore.set('full');

	if (showSearch) {
		// The browser fixture has no native dictionary; return a result only for the selection test.
		Reflect.set(window, '__TAURI_INTERNALS__', {
			invoke: async (command: string) =>
				command === 'classify'
					? 'EN'
					: parameters.has('selectedSearch')
						? [selectedWord]
						: [],
		});
		searchStore.doSearch(parameters.has('selectedSearch') ? 'watermelon' : 'no-match');
	}
</script>

<main>
	{#if parameters.has('headerComparison')}
		<div class="header-comparison">
			<div class="header-comparison__page"><Library /></div>
			<div class="header-comparison__page"><Study /></div>
		</div>
	{:else if parameters.has('searchRoute')}
		<Search />
	{:else if parameters.has('mobileSearchShell')}
		<div class="sheet-fixture">
			<div class="sheet-fixture__header" style:height={compactSheetHeader ? '110px' : '173px'}>
				<button onclick={() => (compactSheetHeader = !compactSheetHeader)}>Toggle header</button>
			</div>
			<div class="mobile-app__content"><MobileSearch /></div>
		</div>
	{:else if parameters.has('mobileSearchRoute')}
		<MobileSearch />
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
	.header-comparison {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 20px;
		height: 100%;
	}
	.header-comparison__page {
		display: flex;
		min-width: 0;
		min-height: 0;
	}
	.sheet-fixture {
		position: fixed;
		inset: 0;
		display: flex;
		flex-direction: column;
	}
	.sheet-fixture__header {
		flex: none;
		background: var(--sy-surface--chrome);
	}
	.mobile-app__content {
		position: relative;
		flex: 1;
		min-height: 0;
		overflow: hidden;
	}
</style>
