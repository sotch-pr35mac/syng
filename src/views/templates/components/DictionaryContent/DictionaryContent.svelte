<script>
import { createEventDispatcher } from 'svelte';
import EntryTopline from './EntryTopline.svelte';
import DefinitionItem from './DefinitionItem.svelte';
import MeasureWord from './MeasureWord.svelte';
import SyButtonBar from '../SyButtonBar/SyButtonBar.svelte';
import SyButton from '../SyButton/SyButton.svelte';
import SyList from '../SyList/SyList.svelte';
import {
	PlusIcon,
	Maximize2Icon,
	MoreHorizontalIcon
} from 'svelte-feather-icons';
import { handleError } from '../../utils/';

/* Word Prop */
export let word;

const invoke = window.__TAURI__.invoke;
const dispatch = createEventDispatcher();
const actions = [
	{
		component: PlusIcon,
		tooltip: 'Add to List',
		action: () => {
			alert('Feature Not Implemented');
			console.log(word);
		}
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
	{
		component: MoreHorizontalIcon,
		tooltip: '',
		action: () => {
			alert('Feature Not Implemented');
		}
	}
];
const handleOpenLink = event => dispatch('link', event.detail);
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
</style>

<div class="dictionary-content-container">
    {#if word}
        <section class="dictionary-content dictionary-content--header">
            <EntryTopline word="{word}" />
            <SyButtonBar>
                {#each actions as action}
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
    {/if}
</div>