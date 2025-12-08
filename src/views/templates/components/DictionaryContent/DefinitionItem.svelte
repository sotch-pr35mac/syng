<script>
	import { createEventDispatcher } from 'svelte';
	import DictionaryLink from './DictionaryLink.svelte';

	/* Required Value Prop */
	export let value;

	const pattern = /\s\S+\[(\S|\s\S)+.\]/g;
	const findPattern = (text) => {
		const matches = text.match(pattern);
		return matches ? matches[0] : null;
	};
	const getCharactersFromMatch = (text) => {
		const characters = text.split('[')[0];
		const breakdown = characters.split('|');
		return {
			traditional: breakdown[0],
			simplified: breakdown[1] || breakdown[0],
		};
	};
	const getDisplayValue = (text) => {
		const characters = getCharactersFromMatch(text);
		return characters.traditional == characters.simplified
			? `${characters.traditional}`
			: `${characters.simplified} (${characters.traditional})`;
	};
	const getLink = (text) => {
		const characters = getCharactersFromMatch(text);
		return characters.traditional;
	};
	const dispatch = createEventDispatcher();
	const handleOpenLink = (event) => dispatch('event', event.detail);
</script>

<div class="dictionary-content--definition-item sy-text--selectable">
	{#if pattern.test(value)}
		{value.split(findPattern(value))}&nbsp;
		<DictionaryLink
			link={getLink(findPattern(value))}
			on:open={handleOpenLink}
		>
			{getDisplayValue(findPattern(value))}
		</DictionaryLink>
	{:else}
		{value}
	{/if}
</div>

<style>
	.dictionary-content--definition-item {
		padding: var(--sy-space--large);
	}
</style>
