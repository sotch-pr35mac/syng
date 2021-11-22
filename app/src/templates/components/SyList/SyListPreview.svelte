<script>
import { createEventDispatcher } from 'svelte';
import SyListPreviewItem from './SyListPreviewItem.svelte';

/* Values Prop */
export let values = [];

// Suppress unexpected prop warning
export const component = undefined;
    
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
	<SyListPreviewItem headline="{value.headline}" subtitle="{value.subtitle}" content="{value.content}" active="{activeIndex === index}" index="{index}" on:click="{handleSelection}"/>
{/each}
