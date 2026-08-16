<script>
	import PreferredCharacters from '@/components/DictionaryContent/PreferredCharacters.svelte';

	/**
	 * @typedef {Object} Props
	 * @property {any} link - Required Link Prop
	 * @property {string} [simplified] - Simplified characters to render according to preferences
	 * @property {string} [traditional] - Traditional characters to render according to preferences
	 * @property {import('svelte').Snippet} [children]
	 * @property {(detail: any) => void} [onopen] - Optional callback when link is opened
	 */

	/** @type {Props} */
	const { link, simplified, traditional, children, onopen } = $props();

	const hasCharacterForms = $derived(
		typeof simplified === 'string' && typeof traditional === 'string'
	);

	const openLink = (event) => {
		onopen?.({
			detail: {
				text: link,
				anchor:
					event.currentTarget instanceof HTMLElement
						? event.currentTarget.getBoundingClientRect()
						: undefined,
			},
		});
	};
</script>

<!-- svelte-ignore a11y_invalid_attribute -->
<a
	href="javascript:void(0)"
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
</a>

<style>
	.dictionary-link {
		cursor: pointer;
		color: var(--sy-color--blue);
	}
	.dictionary-link :global(*) {
		cursor: pointer;
	}
	.dictionary-link:hover {
		color: var(--sy-color--blue-2);
	}
</style>
