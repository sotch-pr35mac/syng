<script>
import { createEventDispatcher } from 'svelte';
import DictionaryLink from './DictionaryLink.svelte';

/* Required Measure Word Prop */
export let value;

const dispatch = createEventDispatcher();
const handleOpenLink = event => dispatch('event', event.detail);
</script>

<style>
.dictionary-content--mw {
	padding: var(--sy-space--large);
}
</style>

<div class="dictionary-content--mw">
	<DictionaryLink link="{value.traditional}" on:open="{handleOpenLink}">
		{ value.simplified }
		{#if value.simplified != value.traditional}
		&nbsp;({value.traditional})
		{/if}
	</DictionaryLink>
</div>