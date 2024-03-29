<script>
import { tick } from 'svelte';
import {
	ChevronLeftIcon,
	ChevronRightIcon
} from 'svelte-feather-icons';
import DictionaryContent from '../components/DictionaryContent/DictionaryContent.svelte';
import SyButton from '../components/SyButton/SyButton.svelte';
import SyList from '../components/SyList/SyList.svelte';
import SyTextInput from '../components/SyTextInput/SyTextInput.svelte';
import { handleError } from '../utils/';

let historyPosition = -1;
let searchHistory = [];
let searchResults = [];
let fullResults = [];
let bookmarks = [];
let activeWord;
let searchLang = 'EN';
let highlightActive = true;
let isMacos = false;
let enableTransparency = false;

// Manually call the tauri platform promise instead of using `window.platform`
// so that we can watch for updates and respond accordingly because this page
// may load prior to `window.platform` being set.
window.__TAURI__.os.platform().then(platform => {
	isMacos = platform === 'darwin';

	// Disabling transparency for now since it doesn't work in Tauri as well as in Electron
	// enableTransparency = isMacos && window.preferenceManager.get('transparency');
});

const invoke = window.__TAURI__.invoke;
const langSwitcher = ['EN', 'PY', 'ZH'];
const updateSearchResults = (results, clearable) => {
	if(results.length || clearable) {
		highlightActive = false;
		fullResults = results;
		searchResults = results.map(element => {
			return {
				headline: element.traditional === element.simplified ? element.simplified : `${element.simplified} (${element.traditional})`,
				subtitle: element.pinyin_marks,
				content: element.english.join('; '),
				active: false
			};
		});
	} 
};
const query = (text, clearable, elementToSelect) => {
	if (text) {
		invoke('classify', { text }).then(result => {
			searchLang = result;
		}).catch(e => {
			handleError('There was an error classifying the language of your query.', e);
		});
		invoke('query', { text }).then(results => {
			updateSearchResults(results, clearable);
			if(elementToSelect != undefined) {
				tick().then(() => {
					selectElement(elementToSelect);
				});
			}
		}).catch(e => {
			handleError('There was an error searching the dictionary for your query.', e);
		});
	} else {
		updateSearchResults([], true);
	}
};
const queryWithLang = (text, lang) => {
	try {
		switch (lang) {
		case 'EN':
			invoke('query_by_english', { text }).then(results => updateSearchResults(results, true));
			break;
		case 'PY':
			invoke('query_by_pinyin', { text }).then(results => updateSearchResults(results, true));
			break;
		case 'ZH':
			invoke('query_by_chinese', { text }).then(results => updateSearchResults(results, true));
			break;
		}
	} catch (error) {
		handleError('There was an error searching the dictionary for your query.', error);
	}
};
const updateActiveWord = (word, highlight) => {
	activeWord = word;
	highlightActive = highlight;
};
const historyBack = event => { // eslint-disable-line no-unused-vars
	historyPosition -= 1;
	updateActiveWord(searchHistory[historyPosition], false);
};
const historyForward = event => { // eslint-disable-line no-unused-vars
	historyPosition += 1;
	updateActiveWord(searchHistory[historyPosition], false);
};
const switchLang = () => {
	const incrementedIndex = langSwitcher.indexOf(searchLang) + 1;
	searchLang = langSwitcher[incrementedIndex < langSwitcher.length ? incrementedIndex : 0];
	queryWithLang(document.getElementById('search').value, searchLang);
};
const selectElement = index => {
	try {
		document.getElementsByClassName('sy-list-preview-item-container')[index].click();
	} catch(error) {
		// Fail silently
	}
};
const handleSelection = event => {
	const word = fullResults[event.detail.index];
	updateActiveWord(word, true);

	// Update search history
	let previousEntry = searchHistory.map(entry => entry.word_id).indexOf(word.word_id);
	if (previousEntry >= 0) {
		searchHistory.splice(previousEntry, 1);
		historyPosition -= 1;
	}
	searchHistory.push(word);
	historyPosition += 1;
};
const handleEnter = event => { // eslint-disable-line no-unused-vars
	selectElement(0);
};
const handleLink = event => {
	const word = event.detail;
	document.getElementById('search').value = word;
	query(word, true, 0);
};
window.bookmarkManager.getLists().then(lists => {
	bookmarks = lists;
}).catch(e => {
	handleError('There was an error fetching word lists. Check the log for more details.', e);
});
</script>

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

<div class="search-page-container">
	<div class="search-bar-container" class:search-bar-container--transparency={enableTransparency} data-testid="search-bar-container" data-tauri-drag-region={isMacos ? true : undefined}>
		<SyButton style="ghost" size="large" disabled={ (searchHistory[historyPosition - 1] == undefined) } on:click="{historyBack}">
			<ChevronLeftIcon size="20" />
		</SyButton>
		<SyButton style="ghost" size="large" disabled={ (searchHistory[historyPosition + 1] == undefined) } on:click="{historyForward}">
			<ChevronRightIcon size="20" />
		</SyButton>
		<SyButton style="ghost" size="large" on:click={ () => switchLang() }>
			{ searchLang }
		</SyButton>
		<SyTextInput spellcheck="false" style="ghost" size="large" placeholder="Search..." id="search" transparency={enableTransparency} on:change={ e => query(e.detail, true) } on:keyup={ e => query(e.detail, false) } on:enter={ handleEnter } />
	</div>
	<div class="search-content-container">
		<div class="search-results" data-elastic>
			<SyList style="preview" values="{searchResults}" highlight="{highlightActive}" on:selection="{handleSelection}"/>
		</div>
		<div class="dictionary-content">
			<DictionaryContent word="{activeWord}" lists="{ bookmarks }" on:link="{handleLink}"/>
		</div>
	</div>
</div>