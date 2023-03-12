<script>
import { ChevronDownIcon, DownloadIcon, PlusIcon, Trash2Icon, UploadIcon } from 'svelte-feather-icons';
import DictionaryContent from '../components/DictionaryContent/DictionaryContent.svelte';
import SyButton from '../components/SyButton/SyButton.svelte';
import DividerDropdownItem from '../components/SyDropdown/DividerDropdownItem.svelte';
import SimpleTextDropdownItem from '../components/SyDropdown/SimpleTextDropdownItem.svelte';
import SyDropdown from '../components/SyDropdown/SyDropdown.svelte';
import TextWithIconDropdownItem from '../components/SyDropdown/TextWithIconDropdownItem.svelte';
import SyList from '../components/SyList/SyList.svelte';
import SyModal from '../components/SyModal/SyModal.svelte';
import SyTextInput from '../components/SyTextInput/SyTextInput.svelte';
import { handleError, resolveNameConflict } from '../utils/';

const invoke = window.__TAURI__.invoke;
const isMacos = window.platform === 'darwin';

// Set the active list
// Syng expects there to always be a list called 'Bookmarks'
let activeList = 'Bookmarks';
let activeWord = undefined;

// Get the word lists
let lists = []; // The list of word lists
let dropdownList = []; // The list of dropdown items, including the list of word lists.
const createDropdownList = list => {
	return [...list.map(listName => {
		return {
			text: listName,
			id: listName,
			component: SimpleTextDropdownItem
		};
	}).sort((a, b) => a.text.localeCompare(b.text)),
	...[
		{
			component: DividerDropdownItem
		},
		{
			text: 'Create New',
			id: 'create-new',
			component: TextWithIconDropdownItem,
			icon: PlusIcon,
			color: 'blue',
			hover: 'green'
		}
	]];
};
const updateLists = cb => {
	window.bookmarkManager.getLists().then(wordLists => {
		lists = wordLists;
		dropdownList = createDropdownList(wordLists);
		cb();
	}).catch(e => {
		handleError('There was an error fetching word lists. Check the logs for more details.', e);
	});
};
updateLists(() => undefined);

// Get the words for the active list
let words = [];
let wordList = [];
const getWordList = items => {
	highlightActive = false;
	return items.map(item => {
		return {
			headline: item.traditional === item.simplified ? item.simplified : `${item.simplified} (${item.traditional})`,
			subtitle: item.pinyin_marks,
			content: item.english.join('; '),
			active: false
		};
	});
};
const updateListContent = cb => {
	window.bookmarkManager.getListContent(activeList).then(activeListWords => { 
		words = activeListWords;
		wordList = getWordList(activeListWords);
		cb();
	}).catch(e => {
		handleError('There was an error fetching the word list content. Check the logs for more details.', e);
	});
};
updateListContent(() => undefined);

// Handle active list selection
const updateActiveList = nextList => {
	activeList = nextList;
	updateListContent(() => undefined);
};
const handleListSelection = event => {
	if(event.detail !== 'create-new') {
		updateActiveList(event.detail);
	} else {
		createNewModalVisible = true;
	}
};

// Create New Modal
// Set the create list placeholder text
const createNewPlaceholders = ['HSK 1', 'Week 3 Vocab', 'Internet Slang', 'Idioms', 'Chapter 7'];
const restrictedListNames = ['create-new', 'Bookmarks'];
const getNewPlaceholder = () => createNewPlaceholders.slice(Math.random() * createNewPlaceholders.length)[0];
let createNewModalVisible = false;
let createNewButtonDisabled = false;
const closeNewModal = () => {
	createNewModalVisible = false;
	document.getElementById('create-new-list-input').value = '';
	createNewButtonDisabled = false;
};
const createNewList = () => {
	createNewButtonDisabled = true;
	const newListName = document.getElementById('create-new-list-input').value.trim();
	if(!newListName || restrictedListNames.includes(newListName)) {
		handleError(`Cannot create new list with name ${newListName}.`);
		closeNewModal();
		return;
	}

	window.bookmarkManager.createList(newListName).then(() => {
		updateLists(() => {
			closeNewModal();
		});
	}).catch(e => {
		handleError(`There was an unexpected error while attempting to create the list ${newListName}. Check the log for more details.`, e);
		closeNewModal();
	});
};

// Word Selection
const handleSelection = selected => {
	activeWord = words[selected.detail.index];
	highlightActive = true;
};
let highlightActive = true;

// Actions
let disableDeleteButton = false;
const deleteActiveList = () => {
	disableDeleteButton = true;
	window.__TAURI__.dialog.ask(`Are you sure you want to delete ${activeList}?`, 'Delete List').then(confirmed => {
		if(confirmed) {
			window.bookmarkManager.deleteList(activeList).then(() => {
				updateActiveList('Bookmarks');
				updateLists(() => { disableDeleteButton = false; });
			}).catch(e => {
				handleError(`There was an unexpected error deleting the list ${activeList}. Please check the log for more details.`, e);
				disableDeleteButton = false;
			});
		} else {
			disableDeleteButton = false;
		}
	}).catch(e => {
		handleError(`There was an unexpected error while attempting to delete the list ${activeList}. Check the log for more details.`, e);
		disableDeleteButton = false;
	});
};
let disableExportButton = false;
const exportActiveList = () => {
	disableExportButton = true;
	invoke('export_list_data', { name: activeList, data: words }).then(() => {
		disableExportButton = false;
	}).catch(e => {
		handleError('There was an error exporting your list. Check the log for more details.', e);
		disableExportButton = false;
	});
};
let disableImportButton = false;
const importList = () => {
	disableImportButton = true;
	invoke('import_list_data').then(importArchive => {
		if(importArchive) {
			const listName = resolveNameConflict(importArchive.meta.name, lists);
			window.bookmarkManager.createList(listName).then(() => {
				// List imports from Syng v1 occationally come with duplicated entries where the last entry in the list
				// is the most up to date. Here we deduplicate the list preserving the last instance of a duplicate.
				const entries = importArchive.entries.reduceRight((acc, cur) => acc.find(entry => entry.hash === cur.hash) ? acc : [...acc, cur], []);
				const bulkImport = entries.map(entry => window.bookmarkManager.addToList(listName, entry));
				return Promise.all(bulkImport);
			}).then(() => {
				updateLists(() => { disableImportButton = false; });
			}).catch(e => {
				handleError('There was an error importing the list. Check the log for more details.', e);
				disableImportButton = false;
			});
		} else {
			disableImportButton = false;
		}
	}).catch(e => {
		handleError('There was an error importing the list. Check the log for more details.', e);
		disableImportButton = false;
	});
};

const actions = [
	{
		icon: DownloadIcon,
		action: importList,
		tooltip: 'Import',
		exclude: [],
		disabled: false
	},
	{
		icon: UploadIcon,
		action: exportActiveList,
		tooltip: 'Export',
		exclude: [],
		disabled: false
	},
	{
		icon: Trash2Icon,
		action: deleteActiveList,
		tooltip: 'Delete',
		exclude: ['Bookmarks'],
		disabled: disableDeleteButton,
		hover: 'red'
	}
];
</script>

<style>
.bookmarks--container {
	display: flex;
	flex-direction: column;
	height: 100vh;
	width: 100%;
}
.bookmarks--header {
	display: flex;
	padding: var(--sy-space--extra-large) var(--sy-space--large);
	margin: 0;
	background-color: var(--sy-color--white);
	box-shadow: var(--sy-box-shadow);
	z-index: var(--sy-z-index--base-2);
	align-items: center;
	justify-content: space-between;
}
.bookmarks--header--actions {
	display: flex;
	flex-direction: row;
	align-items: center;
}
.bookmarks--header--action-item {
	margin: var(--sy-space);
}
.bookmarks--content {
	display: flex;
}
.bookmarks--word-listing {
	display: flex;
	flex: 2;
	z-index: var(--sy-z-index--base);
	flex-direction: column;
	background-color: var(--sy-color--white);
	height: calc(100vh - 83px);
	overflow-y: scroll;
	overflow-x: hidden;
}
.bookmarks-modal-content {
  display: flex;
  flex-direction: column;
  justify-content: center;
}
/* TODO: Move this to componenet before merging */
.dictionary-content {
	display: flex;
	flex: 9;
	box-shadow: 0px 4px 4px rgba(0, 0, 0, 0, 0.25);
	height: calc(100vh - 83px);
	z-index: var(--sy-z-index--base-1);
}
</style>

<div class="bookmarks--container">
	<div class="bookmarks--header" data-tauri-drag-region={isMacos ? true : undefined}>
		<SyDropdown values="{ dropdownList }" on:selection="{ handleListSelection }">
			<SyButton size="large" style="ghost" center={true}>
				{ activeList }&nbsp;<ChevronDownIcon size="20" />
			</SyButton>
		</SyDropdown>
		<div class="bookmarks--header--actions">
			{#each actions as action}
				{#if !action.exclude.includes(activeList)}
					<span class="bookmarks--header--action-item">
						<SyButton style="ghost" on:click="{ action.action }" disabled="{ action.disabled }" hover="{ action.hover }" classes="{ ['sy-tooltip--container'] }">
							<svelte:component this={action.icon} size="20" />
							<div class="sy-tooltip--body sy-tooltip--body-bottom">
								<p>{ action.tooltip }</p>
							</div>
						</SyButton>
					</span>
				{/if}
			{/each}
		</div>
	</div>
	<div class="bookmarks--content">
		<div class="bookmarks--word-listing" data-elastic>
			<SyList style="preview" values="{ wordList }" highlight="{ highlightActive }" on:selection="{ handleSelection }" filterable="{ true }"/>
		</div>
		<div class="dictionary-content">
			<DictionaryContent word="{ activeWord }" lists="{ lists }"/>
		</div>
	</div>
	<SyModal title="Create List" visible="{ createNewModalVisible }" on:close="{ closeNewModal }">
		<div class="bookmarks-modal-content" slot="body">
			<p>What would you like to call this list?</p>
			<SyTextInput size="large" placeholder="{ `ex. ${getNewPlaceholder()}` }" id="create-new-list-input" />
		</div>
		<svelte:fragment slot="footer">
			<SyButton size="large" on:click="{ closeNewModal }">
				Cancel
			</SyButton>
			&nbsp;
			<SyButton size="large" color="green" on:click="{ createNewList }" disabled="{ createNewButtonDisabled }">
				Create
			</SyButton>
		</svelte:fragment>
	</SyModal>
</div>