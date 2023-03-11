<script>
import { createEventDispatcher } from 'svelte';
import { suppressUnusedExportLet } from '../../utils/';
import SyTextInput from '../SyTextInput/SyTextInput.svelte';
import SyListPreviewItem from './SyListPreviewItem.svelte';

const id = Math.floor(Math.random() * 100);

/* Values Prop */
export let values = [];

/* Highlight Prop */
export let highlight = true;

/* Filterable Prop */
export let filterable = false;

// Suppress the unexpected prop warning
export let component = undefined;
suppressUnusedExportLet(component);

let activeIndex;
let filteredValues = [];
$: if(values) {
	filteredValues = values;

	// Reset the filter text field
	if(filterable) {
		const filterInput = document.getElementById(id);
		if(filterInput) {
			filterInput.value = '';
		}
	}
}

const dispatch = createEventDispatcher();
const handleSelection = event => {
	activeIndex = event.detail;
	dispatch('selection', {
		index: values.indexOf(filteredValues[activeIndex]),
		value: filteredValues[activeIndex]
	});
};
const handleFilter = text => {
	text = text.detail;
	filteredValues = values.filter(item => {
		return item.content.includes(text) || item.headline.includes(text) || item.subtitle.includes(text);
	});
};
</script>

{#if filterable}
	<SyTextInput spellcheck="{ false }" placeholder="Filter" size="large" id="{ id }" on:keyup="{ handleFilter }" />
{/if}
{#each filteredValues as value, index }
	<SyListPreviewItem headline="{value.headline}" subtitle="{value.subtitle}" content="{value.content}" active="{activeIndex === index}" index="{index}" highlight="{highlight}" on:click="{handleSelection}" on:event/>
{/each}