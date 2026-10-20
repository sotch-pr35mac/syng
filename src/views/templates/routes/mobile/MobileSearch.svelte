<script lang="ts">
	import { onMount, tick } from 'svelte';
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import SyList from '@/components/SyList/SyList.svelte';
	import SearchEmptyState from '@/components/Search/SearchEmptyState.svelte';
	import SyTextInput from '@/components/SyTextInput/SyTextInput.svelte';
	import DictionaryContent from '@/components/DictionaryContent/DictionaryContent.svelte';
	import Awa, { AWA_SIZES } from '@/components/Awa/Awa.svelte';
	import DictionaryPopover from '@/components/DictionaryPopover/DictionaryPopover.svelte';
	import SySnapSheet from '@/components/SySnapSheet/SySnapSheet.svelte';
	import { type SheetSnap } from '@/types/snapSheet.js';
	import { untrack } from 'svelte';
	import { searchStore as search } from '@/composables/search.svelte.js';
	import { createClickPositionTracker } from '@/composables/clickPosition.svelte.js';
	import {
		normalizeDictionaryLookupRequest,
		type DictionaryLookupRequest,
	} from '@/composables/dictionaryPopover.svelte.js';
	import type { SearchEntry } from '@/types/search.js';
	import { mobileCharacterWindowWordStore } from '@/stores/mobileCharacterWindowWord.svelte.js';
	import { mobileSearchQueryStore, mobileSearchSnapStore } from '@/stores/mobileSearch.svelte.js';
	import { scrollRestore } from '@/actions/scrollRestore.svelte.js';
	import DictionaryListPreviewContent from '@/components/SyList/DictionaryListPreviewContent.svelte';

	// sheetRef gives us access to collapse/openPartial/openFull on the snap sheet.
	let dictionaryElement = $state<HTMLElement>();
	let sheetRef = $state<SySnapSheet | undefined>(undefined);
	// currentSnap and searchQuery are initialised from the persistent stores so that
	// returning to this screen restores the previous state.
	let currentSnap = $state<SheetSnap>(mobileSearchSnapStore.value);
	let searchQuery = $state(mobileSearchQueryStore.value);
	onMount(search.mount);

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

	const searchResultItems = $derived(search.getResultPreviews(2));

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
		if (search.status === 'ready' && untrack(() => currentSnap) === 'collapsed') {
			sheetRef?.openPartial();
		}
	});

	function handleSnapChange(snap: SheetSnap): void {
		currentSnap = snap;
		mobileSearchSnapStore.set(snap);
	}

	function handleSelectResult(data: {
		index: number;
		value: { word: SearchEntry };
		keyboard?: boolean;
	}): void {
		search.selectResult(data.index);
		mobileCharacterWindowWordStore.set(data.value.word);
		sheetRef?.collapse();
		if (data.keyboard) {
			void tick()
				.then(() => {
					dictionaryElement
						?.querySelector<HTMLElement>('h1')
						?.focus({ preventScroll: true });
					return undefined;
				})
				.catch(() => {});
		}
	}

	const clickTracker = createClickPositionTracker();
	function handleDictionaryLink(request: DictionaryLookupRequest): void {
		const lookup = normalizeDictionaryLookupRequest(request);
		search.lookupPopoverWord({
			...lookup,
			anchor: lookup.anchor ?? clickTracker.lastClickRect,
		});
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
			<div
				class="mobile-search__dict-wrapper"
				bind:this={dictionaryElement}
				onclickcapture={clickTracker.captureClickPosition}
			>
				<DictionaryContent
					word={search.activeWord}
					lists={search.bookmarks}
					onlink={handleDictionaryLink}
				/>
			</div>
		{:else}
			<div class="mobile-search__empty">
				<Awa pose="search" size={AWA_SIZES.detail} />
				<p>Search for a word to get started</p>
			</div>
		{/if}
	</div>

	<SySnapSheet
		accessibleName="Search results"
		bind:this={sheetRef}
		onSnapChange={handleSnapChange}
	>
		<div class="mobile-search__search-row" onfocusin={handleSearchFocus}>
			<SyButton
				aria-label={`Search language: ${search.searchLang} (${search.searchLang === 'EN' ? 'English' : search.searchLang === 'PY' ? 'Pinyin' : 'Chinese'}). Change language`}
				style="ghost"
				size="small"
				color="blue"
				onclick={handleSwitchLang}
			>
				{search.searchLang}
			</SyButton>
			<SyTextInput
				style="ghost"
				size="large"
				placeholder="Search..."
				id="mobile-search-input"
				aria-label="Search dictionary"
				spellcheck={false}
				oninput={handleSearch}
				onenter={() => {
					search.submitSearch();
					if (search.activeWord) {
						mobileCharacterWindowWordStore.set(search.activeWord);
					}
				}}
			/>
		</div>

		<p class="sy-sr-only" role="status" aria-atomic="true">{search.statusMessage}</p>
		<div
			role="region"
			aria-label="Search results"
			aria-busy={search.isSearching}
			class="mobile-search__results"
			class:mobile-search__results--empty={search.status === 'ready' &&
				!search.fullResults.length}
			use:scrollRestore={'mobile-search-results'}
		>
			<SearchEmptyState variant="mobile" />
			<SyList
				style="preview"
				values={searchResultItems}
				component={DictionaryListPreviewContent}
				onselection={handleSelectResult}
			/>
		</div>
	</SySnapSheet>
</div>

<DictionaryPopover
	word={search.popoverWord}
	results={search.popoverResults}
	resultIndex={search.popoverResultIndex}
	lists={search.bookmarks}
	anchor={search.popoverAnchor}
	onselect={search.selectPopoverResult}
	onclose={search.closePopoverDictionary}
	onlink={search.lookupPopoverWord}
/>

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
		flex-direction: column;
		gap: var(--sy-mobile-space--medium);
		padding: var(--sy-mobile-space--large);
		box-sizing: border-box;
		overflow-y: auto;
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: calc(110px + env(safe-area-inset-bottom));
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--sy-text--muted);
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

	.mobile-search__search-row :global(.sy-text-input) {
		flex: 1;
		min-width: 0;
	}
	.mobile-search__results {
		flex: 1;
		overflow-y: auto;
		overflow-x: hidden;
		-webkit-overflow-scrolling: touch;
	}

	.mobile-search__results--empty {
		display: flex;
		flex-direction: column;
		min-height: 0;
		/* The sheet is rendered at full height even when only partly revealed. */
		margin-bottom: var(--sy-snap-sheet-hidden-height, 0px);
		padding-bottom: env(safe-area-inset-bottom, 0px);
	}
</style>
