<script>
import DictionaryContent from '../components/DictionaryContent/DictionaryContent.svelte';
import SyButton from '../components/SyButton/SyButton.svelte';
import SyTextInput from '../components/SyTextInput/SyTextInput.svelte';
import SyList from '../components/SyList/SyList.svelte';
import { handleError } from '../utils/';
import {
	ChevronLeftIcon,
	ChevronRightIcon
} from 'svelte-feather-icons';
let historyPosition = 0;
let searchHistory = [];
let searchResults = [];
let fullResults = [];
let activeWord;
let searchLang = 'EN';
const langSwitcher = ['EN', 'PY', 'ZH'];
const enableDrag = process.platform === 'darwin';
const updateSearchResults = (results, clearable) => {
	if(results.length || clearable) {
            fullResults = results;
        	searchResults = results.map(element => {
        		return {
        			headline: element.traditional === element.simplified ? element.simplified : `${element.traditional} (${element.simplified})`,
                		subtitle: element.pinyinMarks,
                		content: element.english.join('; '),
                		active: false
            		};
        	});
	} 
};
const query = (text, clearable) => {
	if (text) {
		window.dictionary.classify(text).then(result => {
			searchLang = result;
		}).catch(e => {
			handleError('There was an error classifying the language of your query.', e);
		});
		window.dictionary.query(text).then(results => updateSearchResults(results, clearable)).catch(e => {
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
                    		window.dictionary.queryByEnglish(text).then(results => updateSearchResults(results, true));
                    		break;
                	case 'PY':
                    		window.dictionary.queryByPinyin(text).then(results => updateSearchResults(results, true));
                    		break;
                	case 'ZH':
                    		window.dictionary.queryByChinese(text).then(results => updateSearchResults(results, true));
                    		break;
            	}
        } catch (error) {
            handleError('There was an error searching the dictionary for your query.', error);
        }
};
const switchLang = () => {
	const incrementedIndex = langSwitcher.indexOf(searchLang) + 1;
        searchLang = langSwitcher[incrementedIndex < langSwitcher.length ? incrementedIndex : 0];
        queryWithLang(document.getElementById('search').value, searchLang);
};
const handleSelection = event => {
	activeWord = fullResults[event.detail.index];
};
const handleEnter = () => {
	try {
		document.getElementsByClassName('sy-list-preview-item-container')[0].click();
	} catch(e) {
		// Fail silently
	}
};
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
	box-shadow: 0px 4px 4px rgba(0, 0, 0, 0.05);
	z-index: 3;
	align-items: center;
}
.search-bar--container--macos {
	-webkit-app-region: drag;
}
.search-content-container {
	display: flex;
}
.search-results {
	display: flex;
	flex: 2;
	z-index: 1;
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
	z-index: 2;
}
</style>

<div class="search-page-container">
	<div class="search-bar-container" class:search-bar--container--macos={enableDrag}>
		<SyButton style="ghost" size="large" disabled={ (searchHistory[historyPosition - 2] == undefined) }>
			<ChevronLeftIcon size="20" />
		</SyButton>
		<SyButton style="ghost" size="large" disabled={ (searchHistory[historyPosition] == undefined) }>
			<ChevronRightIcon size="20" />
		</SyButton>
		<SyButton style="ghost" size="large" on:click={ () => switchLang() }>
            { searchLang }
		</SyButton>
		<SyTextInput style="ghost" size="large" placeholder="Search..." id="search" on:change={ e => query(e.detail, true) } on:keyup={ e => query(e.detail, false) } on:enter={ e => handleEnter() }/>
	</div>
	<div class="search-content-container">
		<div class="search-results" data-elastic>
			<SyList style="preview" values="{searchResults}" on:selection="{handleSelection}"/>
		</div>
		<div class="dictionary-content">
			<DictionaryContent word="{activeWord}" />
		</div>
	</div>
</div>
