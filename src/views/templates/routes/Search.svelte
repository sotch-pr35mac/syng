<script lang="ts">
	import { walkthroughTarget } from '@/actions/walkthroughTarget.svelte.js';
	import { walkthroughStore } from '@/stores/walkthrough.svelte.js';
	import WalkthroughHelp from '@/components/Walkthrough/WalkthroughHelp.svelte';

	import { onMount } from 'svelte';
	import { ChevronLeft, ChevronRight } from 'lucide-svelte';
	import DictionaryContent from '@/components/DictionaryContent/DictionaryContent.svelte';
	import DictionaryPopover from '@/components/DictionaryPopover/DictionaryPopover.svelte';
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import SyList from '@/components/SyList/SyList.svelte';
	import SearchEmptyState from '@/components/Search/SearchEmptyState.svelte';
	import SyTextInput from '@/components/SyTextInput/SyTextInput.svelte';
	import { platform } from '@tauri-apps/plugin-os';
	import { searchStore as search } from '@/composables/search.svelte.js';
	import { createClickPositionTracker } from '@/composables/clickPosition.svelte.js';
	import {
		normalizeDictionaryLookupRequest,
		type DictionaryLookupRequest,
	} from '@/composables/dictionaryPopover.svelte.js';
	import type { SearchEntry } from '@/types/search.js';
	import { lexicalDisplayId } from '@/types/dictionary.js';
	import { scrollRestore } from '@/actions/scrollRestore.svelte.js';
	import { responsiveLayout } from '@/actions/responsiveLayout.js';
	import { isIPad } from '@/utils/device.js';
	import DictionaryListPreviewContent from '@/components/SyList/DictionaryListPreviewContent.svelte';

	let highlightActive = $state(true);
	const isMacos = platform() === 'macos';
	const isIPadDevice = isIPad();
	onMount(search.mount);

	onMount(() => {
		// Auto-focus the search field so the user can type immediately on launch and
		// on every navigation back to this route. Skipped on iPad (desktop UI, but a
		// hardware keyboard isn't guaranteed and focus would raise the on-screen one).
		if (isIPadDevice || walkthroughStore.visible) {
			return;
		}
		const input = document.getElementById('search') as HTMLInputElement | null;
		input?.focus();
	});

	const searchResults = $derived(search.getResultPreviews());
	const activeResultKey = $derived(
		searchResults.find((result) => result.key === search.activeResultKey)?.key ??
			(search.activeWord
				? searchResults.find(
						(result) =>
							lexicalDisplayId(result.word) === lexicalDisplayId(search.activeWord)
					)?.key
				: null) ??
			null
	);

	function doSearch(text: string, clearable: boolean): void {
		if (text) {
			highlightActive = false;
			search.doSearch(text);
		} else if (clearable) {
			highlightActive = false;
			search.doSearch('');
		}
	}

	const historyBack = (): void => {
		search.historyBack();
		highlightActive = false;
	};

	const historyForward = (): void => {
		search.historyForward();
		highlightActive = false;
	};

	const switchLang = (): void => {
		const input = document.getElementById('search') as HTMLInputElement | null;
		search.switchLang(input?.value ?? '');
	};

	const handleSelection = (data: { index: number; value: { word: SearchEntry } }): void => {
		const word = data.value.word;
		if (!word) {
			return;
		}
		search.selectResult(data.index);
		highlightActive = true;
	};

	const handleEnter = (): void => {
		search.submitSearch();
		highlightActive = true;
	};

	const clickTracker = createClickPositionTracker();
	function handleDictionaryLink(request: DictionaryLookupRequest): void {
		const lookup = normalizeDictionaryLookupRequest(request);
		search.lookupPopoverWord({
			...lookup,
			anchor: lookup.anchor ?? clickTracker.lastClickRect,
		});
	}
</script>

<div
	class="search-page-container"
	use:responsiveLayout={{ thresholdRem: 44, className: 'search-page-container--stacked' }}
>
	<div
		class="search-bar-container"
		class:search-bar-container--ipad={isIPadDevice}
		data-testid="search-bar-container"
		data-tauri-drag-region={isMacos ? true : undefined}
	>
		<SyButton
			guideTarget="search-history"
			aria-label="Previous word"
			style="ghost"
			size="large"
			disabled={!search.canGoBack}
			onclick={historyBack}
		>
			<ChevronLeft size="20" />
		</SyButton>
		<SyButton
			style="ghost"
			size="large"
			aria-label="Next word"
			disabled={!search.canGoForward}
			onclick={historyForward}
		>
			<ChevronRight size="20" />
		</SyButton>
		<SyButton
			guideTarget="search-language"
			aria-label={`Search language: ${search.searchLang} (${search.searchLang === 'EN' ? 'English' : search.searchLang === 'PY' ? 'Pinyin' : 'Chinese'}). Change language`}
			style="ghost"
			size="large"
			onclick={() => switchLang()}
		>
			{search.searchLang}
		</SyButton>
		<div class="search-input">
			<SyTextInput
				spellcheck="false"
				style="ghost"
				size="large"
				placeholder="Search..."
				id="search"
				guideTarget="search-field"
				aria-label="Search dictionary"
				value={search.queryText}
				oninput={(value) => doSearch(value, true)}
				onenter={handleEnter}
			/>
		</div>
	</div>
	<p class="sy-sr-only" role="status" aria-atomic="true">{search.statusMessage}</p>
	<div class="search-content-container">
		<div
			use:walkthroughTarget={'search-results'}
			class="search-results"
			role="region"
			aria-label="Search results"
			aria-busy={search.isSearching}
			data-elastic
			use:scrollRestore={'search-results'}
		>
			<SearchEmptyState />
			<SyList
				style="preview"
				values={searchResults}
				activeKey={activeResultKey}
				component={DictionaryListPreviewContent}
				highlight={highlightActive}
				onselection={handleSelection}
			/>
		</div>
		<div
			class="dictionary-content"
			role="region"
			aria-label="Dictionary entry"
			onclickcapture={clickTracker.captureClickPosition}
		>
			<DictionaryContent
				word={search.activeWord}
				showEmptyState={search.status === 'idle' ||
					(search.status === 'ready' && searchResults.length > 0)}
				emptyStatePose="search"
				emptyStateMessage="Search for a word to get started"
				lists={search.bookmarks}
				onlink={handleDictionaryLink}
			>
				{#snippet emptyStateActions()}
					{#if search.status === 'idle'}
						<WalkthroughHelp guide="dictionary" label="Learn how Search works" />
					{/if}
				{/snippet}
			</DictionaryContent>
		</div>
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
</div>

<style>
	.search-page-container {
		display: flex;
		flex-direction: column;
		height: 100vh;
		width: 100%;
	}
	.search-bar-container {
		display: flex;
		padding: var(--sy-space--extra-large) var(--sy-space--large);
		margin: 0;
		background-color: var(--sy-color--white);
		box-shadow: var(--sy-box-shadow);
		z-index: var(--sy-z-index--base-2);
		align-items: center;
		flex-wrap: wrap;
	}
	.search-input {
		flex: 1 1 12rem;
		min-width: 0;
	}
	.search-input :global(.sy-text-input) {
		box-sizing: border-box;
		width: calc(100% - 2 * (var(--sy-space--small) + var(--sy-space)));
		min-width: 0;
	}
	:global(.search-page-container--stacked) .search-content-container {
		flex-direction: column;
	}
	:global(.search-page-container--stacked) .search-results {
		flex: 1;
		min-height: 0;
		height: auto;
	}
	:global(.search-page-container--stacked) .dictionary-content {
		flex: 2;
		min-width: 0;
		min-height: 0;
		height: auto;
	}
	.search-bar-container--ipad {
		padding-top: max(var(--sy-space--large), env(safe-area-inset-top, 0px));
		padding-bottom: var(--sy-space--large);
	}
	.search-content-container {
		display: flex;
		flex: 1;
		min-height: 0;
	}
	.search-results {
		display: flex;
		flex: 2;
		min-width: 0;
		z-index: var(--sy-z-index--base);
		flex-direction: column;
		background-color: var(--sy-color--white);
		height: 100%;
		overflow-y: scroll;
		overflow-x: hidden;
	}

	/* TODO: Consider moving some of the following styles to the component file itself */
	.dictionary-content {
		display: flex;
		flex: 9;
		min-width: 0;
		box-shadow: 0px 4px 4px rgba(0, 0, 0, 0.25);
		height: 100%;
		z-index: var(--sy-z-index--base-1);
	}
</style>
