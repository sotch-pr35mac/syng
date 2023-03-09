<script>
import { createEventDispatcher } from 'svelte';
import EntryTopline from './EntryTopline.svelte';
import DefinitionItem from './DefinitionItem.svelte';
import MeasureWord from './MeasureWord.svelte';
import SyButtonBar from '../SyButtonBar/SyButtonBar.svelte';
import SyButton from '../SyButton/SyButton.svelte';
import SyList from '../SyList/SyList.svelte';
import SyDropdown from '../SyDropdown/SyDropdown.svelte';
import SimpleTextDropdownItem from '../SyDropdown/SimpleTextDropdownItem.svelte';
import TextWithIconDropdownItem from '../SyDropdown/TextWithIconDropdownItem.svelte';
import {
	PlusIcon,
	Maximize2Icon,
	CheckIcon
} from 'svelte-feather-icons';
import { handleError } from '../../utils/';

/* Word Prop */
export let word;

/* Lists Prop */
export let lists = [];

let memberLists = [];

const updateListMembership = () => {
	window.bookmarkManager.inList(word.hash).then(lists => {
		memberLists = lists;

		// After updating list membership update the 'add to bookmarks' action item icon
		// and tooltip to best reflect the new state.
		// Note: Here, the 'add to bookmarks' action item is assumed to be the first action
		actions[0].component = getBookmarkIcon();
		actions[0].tooltip = getBookmarkTooltip();
	}).catch(e => {
		handleError('There was an error fetching list membership. Check the log for more details.', e);
	});
};
const _modifyListMembership = (fnName, list, word) => {
	window.bookmarkManager[fnName](list, word).then(() => {
		updateListMembership();
	}).catch(e => {
		handleError('There was an error modifying the list membership. Check the log for more details.', {
			e, word, list
		});
	});
};
const removeListMembership = (list, word) => {
	_modifyListMembership('removeFromList', list, word);
};
const addListMembership = (list, word) => {
	_modifyListMembership('addToList', list, word);
};

$: word ? (() => { updateListMembership(); })() : null;

const invoke = window.__TAURI__.invoke;
const dispatch = createEventDispatcher();
const getBookmarkIcon = () => memberLists.length ? CheckIcon : PlusIcon;
const getBookmarkTooltip = () => `${memberLists.length ? 'Remove from' : 'Add to'} ${lists.length > 1 ? 'List' : 'Bookmarks'}`;
$: actions = [
	{
		component: getBookmarkIcon(),
		tooltip: getBookmarkTooltip(),
		action: () => {
			if(lists.length === 1) {
				const bookmarks = lists[0];
				if(memberLists.includes(bookmarks)) {
					removeListMembership(bookmarks, word);
				} else {
					addListMembership(bookmarks, word);
				}
			}
		},
		dropdown: lists.length === 1 ? undefined : lists.map(item => {
			let inList = memberLists.includes(item);
			return {
				text: item,
				id: item,
				component: inList ? TextWithIconDropdownItem : SimpleTextDropdownItem,
				icon: inList ? CheckIcon : undefined,
				hover: inList ? 'red' : undefined
			};
		}),
		classes: ['sy-button--grouped--first']
	},
	{
		component: Maximize2Icon,
		tooltip: 'Enlarge Characters',
		action: () => {
			invoke('open_character_window', { 
				word: {
					traditional: word.traditional,
					simplified: word.simplified
				}
			}).catch(e => {
				handleError('An unknown error occurred while trying to open the enlarged character window. Please check the log for more details.', e);
			});
		}
	},
	/*
	{
		component: MoreHorizontalIcon,
		tooltip: '',
		action: () => {
			alert('Feature Not Implemented');
		}
	}
	*/
];
const handleOpenLink = event => dispatch('link', event.detail);

let saveNotesDebounce;
const saveNotes = () => {
	const cachedWord = word;
	clearTimeout(saveNotesDebounce);
	saveNotesDebounce = setTimeout(() => {
		const notes = document.getElementById('dictionary-content--notes').value.trim();
		window.bookmarkManager.updateProperty(cachedWord.hash, 'notes', notes).then(() => {
			cachedWord.notes = notes;
		}).catch(e => {
			handleError('An unknown error occurred while trying to save the notes. Please check the log for more details.', e);
		});
	}, 500);
};

const handleMembershipModification = e => {
	const listName = e.detail;
	if(memberLists.includes(listName)) {
		// The word is present in the selected list. The user must be
		// requesting to remove the word from this list.
		removeListMembership(listName, word);
	} else {
		// The word is not present in the selected list. The user must be
		// requesting to add the word to that list.
		addListMembership(listName, word);
	}
};
</script>

<style>
.dictionary-content-container {
	width: 100%;
	background-color: var(--sy-color--grey-2);
	overflow-y: scroll;
	overflow-x: hidden;;
}
.dictionary-content {
    padding: var(--sy-space--extra-large);
}
.dictionary-content--header {
    display: flex;
    justify-content: space-between;
}
.dictionary-content--section-title {
    font-size: 1.8em;
    font-weight: 400;
    margin: var(--sy-space--small) var(--sy-space--large);
    color: var(--sy-color--grey-4);
}
.dictionary-content--notes {
	background-color: var(--sy-color--white);
	border-radius: var(--sy-border-radius);
	border: var(--sy-border);
	padding: var(--sy-space--extra-large);
	margin: var(--sy-space--extra-large);
	font-size: var(--sy-font--size);
	color: var(--sy-color--black);
	height: auto;
	/* Full width subtracting the margin on it and its parent to achieve a cross-compatible `-webkit-fill-available` effect */
	width: calc(95% - calc(var(--sy-space--extra-large) + var(--sy-space--extra-large)));
}
</style>

<div class="dictionary-content-container">
	{#if word}
    <section class="dictionary-content dictionary-content--header">
        <EntryTopline word="{word}" />
        <SyButtonBar>
            {#each actions as action}
							{#if action.dropdown }
								<SyDropdown values="{ action.dropdown }" on:selection="{ handleMembershipModification }" position="right">
		              <SyButton grouped="true" classes="{ ['sy-tooltip--container', ...action.classes] }" on:click="{action.action}">
		                  <svelte:component this={action.component} size="18" />
		                  {#if action.tooltip }
		                      <div class="sy-tooltip--body sy-tooltip--body-bottom">
		                          <p>
		                              { action.tooltip }
		                          </p>
		                      </div>
		                  {/if}
		              </SyButton>
								</SyDropdown>
							{:else}
	              <SyButton grouped="true" classes="{ ['sy-tooltip--container'] }" on:click="{action.action}">
	                  <svelte:component this={action.component} size="18" />
	                  {#if action.tooltip }
	                      <div class="sy-tooltip--body sy-tooltip--body-bottom">
	                          <p>
	                              { action.tooltip }
	                          </p>
	                      </div>
	                  {/if}
	              </SyButton>
							{/if}
            {/each}
        </SyButtonBar>
    </section>
    <section class="dictionary-content">
        <h2 class="dictionary-content--section-title">
            Definitions
        </h2>
        <SyList values="{word.english}" component="{DefinitionItem}" on:event="{handleOpenLink}"/>
    </section>
		{#if word.measure_words.length}
		<section class="dictionary-content">
			<h2 class="dictionary-content--section-title">
				Measure Words
			</h2>
			<SyList values="{word.measure_words}" component="{MeasureWord}" on:event="{handleOpenLink}"/>
		</section>
		{/if}
		{#if typeof(word.notes) === 'string'}
			<section class="dictionary-content">
				<h2 class="dictionary-content--section-title">
					Notes
				</h2>
				<textarea placeholder="No Notes" class="dictionary-content--notes" id="dictionary-content--notes" on:input="{saveNotes}">{ word.notes }</textarea>
			</section>
		{/if}
	{/if}
</div>
