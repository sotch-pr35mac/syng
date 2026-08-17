<script>
	import DictionaryLink from '@/components/DictionaryContent/DictionaryLink.svelte';

	/**
	 * @typedef {Object} Props
	 * @property {any} value - Required Value Prop
	 * @property {(detail: any) => void} [onevent] - Optional callback when link event occurs
	 */

	/** @type {Props} */
	const { value, onevent } = $props();

	const pattern = /\s\S+\[(\S|\s\S)+.\]/g;
	const findPattern = (text) => {
		const matches = text.match(pattern);
		return matches ? matches[0] : null;
	};
	const getCharactersFromMatch = (text) => {
		const characters = text.split('[')[0];
		const breakdown = characters.split('|');
		return {
			traditional: breakdown[0].trim(),
			simplified: (breakdown[1] || breakdown[0]).trim(),
		};
	};
	const match = $derived(findPattern(value));
	const characters = $derived(match ? getCharactersFromMatch(match) : undefined);
	const handleOpenLink = (event) => onevent?.(event.detail);
</script>

<div class="dictionary-content--definition-item sy-text--selectable">
	{#if match && characters}
		{value.split(match)}&nbsp;
		<DictionaryLink
			link={characters.traditional}
			simplified={characters.simplified}
			traditional={characters.traditional}
			onopen={handleOpenLink}
		/>
	{:else}
		{value}
	{/if}
</div>

<style>
	.dictionary-content--definition-item {
		padding: var(--sy-space--large);
	}
</style>
