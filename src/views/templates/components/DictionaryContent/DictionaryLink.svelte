<script>
	import { walkthroughTarget } from '@/actions/walkthroughTarget.svelte.js';
	import PreferredCharacters from '@/components/DictionaryContent/PreferredCharacters.svelte';

	/**
	 * @typedef {Object} Props
	 * @property {any} link - Required Link Prop
	 * @property {string} [simplified] - Simplified characters to render according to preferences
	 * @property {string} [traditional] - Traditional characters to render according to preferences
	 * @property {string} [lexicalId] - Canonical lexical ID for direct dictionary lookup
	 * @property {import('svelte').Snippet} [children]
	 * @property {(detail: any) => void} [onopen] - Optional callback when link is opened
	 */

	/** @type {Props} */
	const { link, simplified, traditional, lexicalId, children, onopen } = $props();

	const hasCharacterForms = $derived(
		typeof simplified === 'string' && typeof traditional === 'string'
	);

	const openLink = (event) => {
		onopen?.({
			detail: {
				text: link,
				...(lexicalId ? { lexicalId } : {}),
				anchor:
					event.currentTarget instanceof HTMLElement
						? event.currentTarget.getBoundingClientRect()
						: undefined,
			},
		});
	};
</script>

<button
	use:walkthroughTarget={'dictionary-link'}
	type="button"
	class="dictionary-link"
	onclick={openLink}
	data-testid="dictionary-link"
>
	{#if hasCharacterForms}
		<PreferredCharacters
			{simplified}
			{traditional}
			variant="inline"
			lexicalTestIdPrefix="dictionary-link"
		/>
	{:else}
		{@render children?.()}
	{/if}
</button>

<style>
	.dictionary-link {
		display: inline;
		padding: 0;
		border: 0;
		background: transparent;
		font: inherit;
		text-align: inherit;
		cursor: pointer;
		color: var(--sy-text--blue);
	}
	.dictionary-link :global(*) {
		cursor: pointer;
	}
	.dictionary-link:hover {
		text-decoration: underline;
	}
</style>
