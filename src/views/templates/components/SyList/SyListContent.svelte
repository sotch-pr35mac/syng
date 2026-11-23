<script>
	import { isMobile } from '@/utils/device.js';
	import SyListItem from '@/components/SyList/SyListItem.svelte';
	/** @typedef {import('svelte').Snippet} Snippet */

	/* Component Prop */
	// The component to render as a list item

	/**
	 * @typedef {Object} Props
	 * @property {any} [values] - Values Prop
	 * @property {any} [component] - Data rows must accept a value prop
	 * @property {any} [highlight] - Suppress the unexpected prop warning
	 * @property {any} [filterable]
	 * @property {string | number | null} [activeKey] - Suppress the unexpected prop warning
	 * @property {string} [filterValue] - Suppress the unexpected prop warning
	 * @property {(detail: any) => void} [onselection] - Selection callback
	 * @property {(values: any[]) => void} [onvisiblechange] - Suppress the unexpected prop warning
	 * @property {(detail: any) => void} [onevent] - Event callback
	 * @property {Snippet} [children] - Custom list rows
	 * @property {boolean} [bare] - Keep list structure without a surface
	 */

	const mobile = isMobile();

	/* eslint-disable prefer-const, no-useless-assignment -- the dynamic SyList contract requires a bindable filterValue for both styles */
	/** @type {Props} */
	let {
		values = [],
		component,
		highlight: _highlight = undefined,
		filterable: _filterable = undefined,
		activeKey: _activeKey = undefined,
		filterValue: _filterValue = $bindable(''),
		onselection,
		onvisiblechange: _onvisiblechange,
		onevent,
		children,
		bare = false,
	} = $props();
	/* eslint-enable prefer-const, no-useless-assignment */
</script>

<div
	class="sy-list--container"
	class:sy-list--container--mobile={mobile}
	class:sy-list--container--bare={bare}
>
	{#if children}{@render children()}{/if}
	{#each values as value, index (index)}
		{@const SvelteComponent = component}
		<SyListItem>
			<SvelteComponent {value} {onselection} {onevent} />
		</SyListItem>
	{/each}
</div>

<style>
	.sy-list--container {
		padding: var(--sy-space);
		margin: var(--sy-space--extra-large);
		background-color: var(--sy-surface--content);
		border-radius: var(--sy-border-radius--content-list);
		outline: 1px solid var(--sy-content-card-edge, transparent);
		box-shadow: var(--sy-shadow--content);
	}
	.sy-list--container--mobile {
		padding: 0;
		margin: var(--sy-mobile-space--medium) 0;
		border: var(--sy-mobile-surface-border);
		outline: none;
		box-shadow: none;
		overflow: hidden;
	}
	.sy-list--container :global(.sy-list--list-item + .sy-list--list-item) {
		border-top: var(--sy-border);
	}
	.sy-list--container--bare {
		display: flex;
		flex-direction: column;
		gap: var(--sy-mobile-space--large);
		padding: 0;
		margin: 0;
		background: transparent;
		border: 0;
		outline: none;
		box-shadow: none;
		overflow: visible;
	}
	.sy-list--container--bare :global(.sy-list--list-item + .sy-list--list-item) {
		border-top: 0;
	}
	.sy-list--container--bare :global(.sy-list--items) {
		display: flex;
		flex-direction: column;
		gap: var(--sy-mobile-space--large);
	}
</style>
