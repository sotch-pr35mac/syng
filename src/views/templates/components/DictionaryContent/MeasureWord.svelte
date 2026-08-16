<script>
	import DictionaryLink from '@/components/DictionaryContent/DictionaryLink.svelte';

	/**
	 * @typedef {Object} Props
	 * @property {any} value - Required Measure Word Prop
	 * @property {(detail: any) => void} [onevent] - Event callback
	 */

	/** @type {Props} */
	const { value, onevent } = $props();

	const handleOpenLink = (event) => onevent?.(event.detail);
</script>

<div class="dictionary-content--mw sy-text--selectable">
	<DictionaryLink
		link={value.traditional}
		simplified={value.simplified}
		traditional={value.traditional}
		onopen={handleOpenLink}
	/>
</div>

<style>
	.dictionary-content--mw {
		padding: var(--sy-space--large);
	}
</style>
