<script lang="ts">
	import { tick } from 'svelte';
	import { ChevronLeft, ChevronRight } from 'lucide-svelte';
	import DictionaryContent from '@/components/DictionaryContent/DictionaryContent.svelte';
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import SyList from '@/components/SyList/SyList.svelte';
	import SyTextInput from '@/components/SyTextInput/SyTextInput.svelte';
	import { platform } from '@tauri-apps/plugin-os';
	import { searchStore as search } from '@/composables/search.svelte.js';
	import type { SearchEntry } from '@/types/search.js';
	import { scrollRestore } from '@/actions/scrollRestore.svelte.js';
	import { isIPad } from '@/utils/device.js';

	let highlightActive = $state(true);
	const isMacos = platform() === 'macos';
	const isIPadDevice = isIPad();

	const searchResults = $derived(
		search.fullResults.map((entry) => ({
			headline:
				entry.traditional === entry.simplified
					? entry.simplified
					: `${entry.simplified} (${entry.traditional})`,
			subtitle: entry.pinyin_marks,
			content: entry.english.join('; '),
			active: false,
			_entry: entry,
		}))
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

	const selectElement = (index: number): void => {
		const container = document.querySelector('.search-results');
		if (!container) {
			return;
		}
		const elements = container.getElementsByClassName('sy-list-preview-item-container');
		if (elements[index]) {
			(elements[index] as HTMLElement).click();
		}
	};

	const getActiveWordResultIndex = (): number => {
		if (!search.activeWord) {
			return -1;
		}
		return searchResults.findIndex((result) => result._entry.hash === search.activeWord?.hash);
	};

	let replayedWordHash = $state<string | undefined>(undefined);
	$effect(() => {
		const activeWordHash = search.activeWord?.hash;
		if (!activeWordHash) {
			replayedWordHash = undefined;
			return;
		}
		if (replayedWordHash === activeWordHash) {
			return;
		}
		const resultIndex = getActiveWordResultIndex();
		if (resultIndex < 0) {
			return;
		}
		replayedWordHash = activeWordHash;
		tick()
			.then(() => {
				selectElement(resultIndex);
				return undefined;
			})
			.catch(() => {});
	});

	const handleSelection = (data: { value: { _entry: SearchEntry } }): void => {
		const word = data.value._entry;
		if (!word) {
			return;
		}
		replayedWordHash = word.hash;
		search.setActiveWord(word);
		search.pushHistory(word);
		highlightActive = true;
	};

	const handleEnter = (): void => {
		selectElement(0);
	};

	const handleLink = (word: string): void => {
		const input = document.getElementById('search') as HTMLInputElement | null;
		if (input) {
			input.value = word;
		}
		doSearch(word, true);
		tick()
			.then(() => {
				selectElement(0);
				return undefined;
			})
			.catch(() => {});
	};
</script>

<div class="search-page-container">
	<div
		class="search-bar-container"
		class:search-bar-container--ipad={isIPadDevice}
		data-testid="search-bar-container"
		data-tauri-drag-region={isMacos ? true : undefined}
	>
		<SyButton style="ghost" size="large" disabled={!search.canGoBack} onclick={historyBack}>
			<ChevronLeft size="20" />
		</SyButton>
		<SyButton
			style="ghost"
			size="large"
			disabled={!search.canGoForward}
			onclick={historyForward}
		>
			<ChevronRight size="20" />
		</SyButton>
		<SyButton style="ghost" size="large" onclick={() => switchLang()}>
			{search.searchLang}
		</SyButton>
		<SyTextInput
			spellcheck="false"
			style="ghost"
			size="large"
			placeholder="Search..."
			id="search"
			onchange={(value) => doSearch(value, true)}
			onkeyup={(value) => doSearch(value, false)}
			onenter={handleEnter}
		/>
	</div>
	<div class="search-content-container">
		<div class="search-results" data-elastic use:scrollRestore={'search-results'}>
			<SyList
				style="preview"
				values={searchResults}
				highlight={highlightActive}
				onselection={handleSelection}
			/>
		</div>
		<div class="dictionary-content">
			<DictionaryContent
				word={search.activeWord}
				lists={search.bookmarks}
				onlink={handleLink}
			/>
		</div>
	</div>
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
	}
	.search-bar-container--ipad {
		padding-top: var(--sy-space--large);
		padding-bottom: var(--sy-space--large);
	}
	.search-content-container {
		display: flex;
	}
	.search-results {
		display: flex;
		flex: 2;
		z-index: var(--sy-z-index--base);
		flex-direction: column;
		background-color: var(--sy-color--white);
		height: calc(100vh - 83px);
		overflow-y: scroll;
		overflow-x: hidden;
	}

	/* TODO: Consider moving some of the following styles to the component file itself */
	.dictionary-content {
		display: flex;
		flex: 9;
		box-shadow: 0px 4px 4px rgba(0, 0, 0, 0.25);
		height: calc(100vh - 83px);
		z-index: var(--sy-z-index--base-1);
	}
</style>
