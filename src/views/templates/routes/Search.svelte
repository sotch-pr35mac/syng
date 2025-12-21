<script>
	import { tick } from 'svelte';
	import { ChevronLeft, ChevronRight } from 'lucide-svelte';
	import DictionaryContent from '../components/DictionaryContent/DictionaryContent.svelte';
	import SyButton from '../components/SyButton/SyButton.svelte';
	import SyList from '../components/SyList/SyList.svelte';
	import SyTextInput from '../components/SyTextInput/SyTextInput.svelte';
	import { handleError } from '../utils/';
	import { invoke } from '@tauri-apps/api/core';
	import { platform } from '@tauri-apps/plugin-os';

	let historyPosition = $state(-1);
	const searchHistory = [];
	let searchResults = $state([]);
	let fullResults = [];
	let bookmarks = $state([]);
	let activeWord = $state();
	let searchLang = $state('EN');
	let highlightActive = $state(true);
	const enableTransparency = false;
	const isMacos = platform() === 'macos';
	// Disabling transparency for now since it doesn't work in Tauri as well as in Electron
	// enableTransparency = isMacos && window.preferenceManager.get('transparency');

	const langSwitcher = ['EN', 'PY', 'ZH'];
	const updateSearchResults = (results, clearable) => {
		if (results.length || clearable) {
			highlightActive = false;
			fullResults = results;
			searchResults = results.map((element) => {
				return {
					headline:
						element.traditional === element.simplified
							? element.simplified
							: `${element.simplified} (${element.traditional})`,
					subtitle: element.pinyin_marks,
					content: element.english.join('; '),
					active: false,
				};
			});
		}
	};
	const query = (text, clearable, elementToSelect) => {
		if (text) {
			invoke('classify', { text })
				.then((result) => {
					searchLang = result;
					return undefined;
				})
				.catch((e) => {
					handleError('There was an error classifying the language of your query.', e);
				});
			invoke('query', { text })
				.then((results) => {
					updateSearchResults(results, clearable);
					if (elementToSelect !== undefined) {
						return tick().then(() => {
							selectElement(elementToSelect);
							return undefined;
						});
					}
					return undefined;
				})
				.catch((e) => {
					handleError('There was an error searching the dictionary for your query.', e);
				});
		} else {
			updateSearchResults([], true);
		}
	};
	const queryWithLang = (text, lang) => {
		const handleResults = (results) => {
			updateSearchResults(results, true);
			return undefined;
		};
		const handleQueryError = (e) => {
			handleError('There was an error searching the dictionary for your query.', e);
		};
		switch (lang) {
			case 'EN':
				invoke('query_by_english', { text }).then(handleResults).catch(handleQueryError);
				break;
			case 'PY':
				invoke('query_by_pinyin', { text }).then(handleResults).catch(handleQueryError);
				break;
			case 'ZH':
				invoke('query_by_chinese', { text }).then(handleResults).catch(handleQueryError);
				break;
		}
	};
	const updateActiveWord = (word, highlight) => {
		activeWord = word;
		highlightActive = highlight;
	};
	const historyBack = () => {
		historyPosition -= 1;
		updateActiveWord(searchHistory[historyPosition], false);
	};
	const historyForward = () => {
		historyPosition += 1;
		updateActiveWord(searchHistory[historyPosition], false);
	};
	const switchLang = () => {
		const incrementedIndex = langSwitcher.indexOf(searchLang) + 1;
		searchLang = langSwitcher[incrementedIndex < langSwitcher.length ? incrementedIndex : 0];
		queryWithLang(document.getElementById('search').value, searchLang);
	};
	const selectElement = (index) => {
		const elements = document.getElementsByClassName('sy-list-preview-item-container');
		if (elements[index]) {
			elements[index].click();
		}
	};
	const handleSelection = (data) => {
		const word = fullResults[data.index];
		updateActiveWord(word, true);

		// Update search history
		const previousEntry = searchHistory.map((entry) => entry.word_id).indexOf(word.word_id);
		if (previousEntry >= 0) {
			searchHistory.splice(previousEntry, 1);
			historyPosition -= 1;
		}
		searchHistory.push(word);
		historyPosition += 1;
	};
	const handleEnter = () => {
		selectElement(0);
	};
	const handleLink = (word) => {
		document.getElementById('search').value = word;
		query(word, true, 0);
	};
	window.bookmarkManager
		.getLists()
		.then((lists) => {
			bookmarks = lists;
			return undefined;
		})
		.catch((e) => {
			handleError(
				'There was an error fetching word lists. Check the log for more details.',
				e
			);
		});
</script>

<div class="search-page-container">
	<div
		class="search-bar-container"
		class:search-bar-container--transparency={enableTransparency}
		data-testid="search-bar-container"
		data-tauri-drag-region={isMacos ? true : undefined}
	>
		<SyButton
			style="ghost"
			size="large"
			disabled={searchHistory[historyPosition - 1] === undefined}
			onclick={historyBack}
		>
			<ChevronLeft size="20" />
		</SyButton>
		<SyButton
			style="ghost"
			size="large"
			disabled={searchHistory[historyPosition + 1] === undefined}
			onclick={historyForward}
		>
			<ChevronRight size="20" />
		</SyButton>
		<SyButton style="ghost" size="large" onclick={() => switchLang()}>
			{searchLang}
		</SyButton>
		<SyTextInput
			spellcheck="false"
			style="ghost"
			size="large"
			placeholder="Search..."
			id="search"
			transparency={enableTransparency}
			onchange={(value) => query(value, true)}
			onkeyup={(value) => query(value, false)}
			onenter={handleEnter}
		/>
	</div>
	<div class="search-content-container">
		<div class="search-results" data-elastic>
			<SyList
				style="preview"
				values={searchResults}
				highlight={highlightActive}
				onselection={handleSelection}
			/>
		</div>
		<div class="dictionary-content">
			<DictionaryContent word={activeWord} lists={bookmarks} onlink={handleLink} />
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
	.search-bar-container--transparency {
		background-color: var(--sy-color--white--transparency);
	}
	.search-content-container {
		display: flex;
	}
	.search-results {
		display: flex;
		flex: 2;
		z-index: var(--sy-index--base);
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
