<script>
import { createEventDispatcher } from 'svelte';
import { suppressUnusedExportLet } from '../../utils/';
import SyListPreviewItem from './SyListPreviewItem.svelte';

/* Values Prop */
export let values = [];

/* Highlight Prop */
export let highlight = true;

// Suppress the unexpected prop warning
export let component = undefined;
suppressUnusedExportLet(component);

let activeIndex;

const dispatch = createEventDispatcher();
const handleSelection = event => {
	activeIndex = event.detail;
	dispatch('selection', {
		index: activeIndex,
		value: values[activeIndex]
	});
};
</script>

{#each values as value, index }
	<SyListPreviewItem headline="{value.headline}" subtitle="{value.subtitle}" content="{value.content}" active="{activeIndex === index}" index="{index}" highlight="{highlight}" on:click="{handleSelection}" on:event/>
{/each}
