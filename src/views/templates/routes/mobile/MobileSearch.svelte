<script lang="ts">
	import { onMount } from 'svelte';
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import SyList from '@/components/SyList/SyList.svelte';
	import SyTextInput from '@/components/SyTextInput/SyTextInput.svelte';
	import DictionaryContent from '@/components/DictionaryContent/DictionaryContent.svelte';
	import SySnapSheet from '@/components/SySnapSheet/SySnapSheet.svelte';
	import type { SyListPreviewValue } from '@/components/SyList/SyListPreview.types.js';
	import { type SheetSnap } from '@/types/snapSheet.js';
	import { untrack } from 'svelte';
	import { searchStore as search } from '@/composables/search.svelte.js';
	import type { SearchEntry } from '@/types/search.js';
	import { mobileCharacterWindowWordStore } from '@/stores/mobileCharacterWindowWord.svelte.js';
	import { mobileSearchQueryStore, mobileSearchSnapStore } from '@/stores/mobileSearch.svelte.js';
	import { scrollRestore } from '@/actions/scrollRestore.svelte.js';

	// sheetRef gives us access to collapse/openPartial/openFull on the snap sheet.
	let sheetRef = $state<SySnapSheet | undefined>(undefined);
	// currentSnap and searchQuery are initialised from the persistent stores so that
	// returning to this screen restores the previous state.
	let currentSnap = $state<SheetSnap>(mobileSearchSnapStore.value);
	let searchQuery = $state(mobileSearchQueryStore.value);

	type SearchResultPreviewItem = SyListPreviewValue & {
		_entry: SearchEntry;
	};

	onMount(() => {
		// SyTextInput is uncontrolled so we restore the value imperatively after mount.
		const input = document.getElementById('mobile-search-input') as HTMLInputElement | null;
		if (input && searchQuery) {
			input.value = searchQuery;
		}

		// Restore the sheet snap position. The auto-open $effect below only fires when
		// new results arrive — it won't re-trigger on a navigation round-trip where results
		// are already populated — so we restore the stored position explicitly here.
		if (currentSnap === 'partial') {
			sheetRef?.openPartial();
		} else if (currentSnap === 'full') {
			sheetRef?.openFull();
		}
		// If currentSnap is 'collapsed', the user manually dismissed the sheet — leave it closed.
	});

	const searchResultItems: SearchResultPreviewItem[] = $derived(
		search.fullResults.map((entry) => ({
			key: entry.hash,
			headline:
				entry.simplified !== entry.traditional
					? `${entry.simplified} (${entry.traditional})`
					: entry.simplified,
			subtitle: entry.pinyin_marks,
			content: entry.english.slice(0, 2).join('; '),
			_entry: entry,
		}))
	);

	// Track the results array reference to detect when a new search completes. Initialised
	// to the current reference so that on mount (with pre-existing results) the effect is a
	// no-op — only actual new searches trigger the auto-open.
	let prevResultsRef = search.fullResults;
	$effect(() => {
		const currentResults = search.fullResults;
		if (currentResults === prevResultsRef) {
			return;
		}
		prevResultsRef = currentResults;
		if (currentResults.length > 0 && untrack(() => currentSnap) === 'collapsed') {
			sheetRef?.openPartial();
		}
	});

	function handleSnapChange(snap: SheetSnap): void {
		currentSnap = snap;
		mobileSearchSnapStore.set(snap);
	}

	function handleSelectResult(data: { value: { _entry: SearchEntry } }): void {
		search.setActiveWord(data.value._entry);
		mobileCharacterWindowWordStore.set(data.value._entry);
		sheetRef?.collapse();
	}

	function handleLink(word: string): void {
		searchQuery = word;
		mobileSearchQueryStore.set(word);
		search.doSearch(word);
		sheetRef?.openPartial();
	}

	function handleSearch(value: string): void {
		searchQuery = value;
		mobileSearchQueryStore.set(value);
		search.doSearch(value);
	}

	function handleSearchFocus(): void {
		if (currentSnap === 'collapsed') {
			sheetRef?.openPartial();
		}
	}

	function handleSwitchLang(): void {
		search.switchLang(searchQuery);
	}
</script>

<div class="mobile-search">
	<div class="mobile-search__content" use:scrollRestore={'mobile-search-content'}>
		{#if search.activeWord}
			<div class="mobile-search__dict-wrapper">
				<DictionaryContent
					word={search.activeWord}
					lists={search.bookmarks}
					onlink={handleLink}
				/>
			</div>
		{:else}
			<div class="mobile-search__empty">
				<p>Search for a word to get started</p>
			</div>
		{/if}
	</div>

	<SySnapSheet bind:this={sheetRef} onSnapChange={handleSnapChange}>
		<div class="mobile-search__search-row" onfocusin={handleSearchFocus}>
			<SyButton style="ghost" size="small" color="blue" onclick={handleSwitchLang}>
				{search.searchLang}
			</SyButton>
			<SyTextInput
				style="ghost"
				size="large"
				placeholder="Search..."
				id="mobile-search-input"
				spellcheck={false}
				onkeyup={handleSearch}
				onchange={handleSearch}
			/>
		</div>

		<div class="mobile-search__results" use:scrollRestore={'mobile-search-results'}>
			<SyList style="preview" values={searchResultItems} onselection={handleSelectResult} />
		</div>
	</SySnapSheet>
</div>

<style>
	.mobile-search {
		position: relative;
		height: 100%;
		overflow: hidden;
		background-color: var(--sy-color--grey-2);
	}

	.mobile-search__content {
		height: 100%;
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
		overscroll-behavior: none;
		background-color: var(--sy-color--grey-2);
	}

	.mobile-search__dict-wrapper {
		padding-bottom: calc(110px + env(safe-area-inset-bottom));
	}

	.mobile-search__empty {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: calc(110px + env(safe-area-inset-bottom));
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--sy-color--grey-4);
		font-family: var(--sy-font-family);
		font-size: var(--sy-font-size--mobile-medium);
	}

	.mobile-search__search-row {
		display: flex;
		align-items: center;
		padding: 0 var(--sy-mobile-space--large);
		gap: var(--sy-mobile-space--medium);
		flex-shrink: 0;
	}

	.mobile-search__results {
		flex: 1;
		overflow-y: auto;
		overflow-x: hidden;
		-webkit-overflow-scrolling: touch;
	}
</style>
