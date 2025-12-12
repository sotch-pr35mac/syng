<script>
	/**
	 * @typedef {Object} Props
	 * @property {any} link - Required Link Prop
	 * @property {import('svelte').Snippet} [children]
	 * @property {(detail: any) => void} [onopen] - Optional callback when link is opened
	 */

	/** @type {Props} */
	let { link, children, onopen } = $props();

	const openLink = () => onopen?.({ detail: link });
</script>

<style>
.dictionary-link {
	cursor: pointer;
	color: var(--sy-color--blue);
}
.dictionary-link:hover {
	color: var(--sy-color--blue-2);
}
</style>

<!-- svelte-ignore a11y_invalid_attribute -->
<a href="javascript:void(0)" class="dictionary-link" onclick={() => openLink()} data-testid="dictionary-link">
	{@render children?.()}
</a>