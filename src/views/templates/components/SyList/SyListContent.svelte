<script>
	import { isMobile } from '@/utils/device.js';

	/* Component Prop */
	// The component to render as a list item

	/**
	 * @typedef {Object} Props
	 * @property {any} [values] - Values Prop
	 * @property {any} component - The component must accept a value prop
	 * @property {any} [highlight] - Suppress the unexpected prop warning
	 * @property {any} [filterable]
	 * @property {(detail: any) => void} [onselection] - Selection callback
	 * @property {(detail: any) => void} [onevent] - Event callback
	 */

	const mobile = isMobile();

	/** @type {Props} */
	const {
		values = [],
		component,
		highlight: _highlight = undefined,
		filterable: _filterable = undefined,
		onselection,
		onevent,
	} = $props();
</script>

<div class="sy-list--container" class:sy-list--container--mobile={mobile}>
	{#each values as value, index (index)}
		{@const SvelteComponent = component}
		<div class="sy-list--list-item">
			<SvelteComponent {value} {onselection} {onevent} />
		</div>
	{/each}
</div>

<style>
	.sy-list--container {
		padding: var(--sy-space);
		margin: var(--sy-space--extra-large);
		background-color: var(--sy-color--white);
		border-radius: var(--sy-border-radius);
		box-shadow: var(--sy-inner-shadow);
	}
	.sy-list--container--mobile {
		padding: 0;
		margin: var(--sy-mobile-space--medium) 0;
		border: var(--sy-mobile-surface-border);
		box-shadow: none;
		overflow: hidden;
	}
	.sy-list--list-item {
		border-top: var(--sy-border);
		border-bottom: var(--sy-border);
	}
	.sy-list--list-item:first-child {
		border-top: none;
	}
	.sy-list--list-item:last-child {
		border-bottom: none;
	}
</style>
