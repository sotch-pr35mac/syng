<script lang="ts">
	import type { Snippet } from 'svelte';
	import { ChevronRight } from 'lucide-svelte';

	const {
		label,
		description,
		onclick,
		children,
	}: {
		label: string;
		description: string;
		onclick: () => void;
		children: Snippet;
	} = $props();
</script>

<button type="button" class="sy-list-navigation-row" {onclick}>
	{@render children()}
	<span class="sy-list-navigation-row__copy"
		><strong>{label}</strong><small>{description}</small></span
	>
	<ChevronRight size="17" aria-hidden="true" />
</button>

<style>
	.sy-list-navigation-row {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		min-height: 64px;
		padding: 10px 14px;
		border: 0;
		border-top: var(--sy-mobile-surface-border);
		background: transparent;
		color: var(--sy-color--black);
		font: inherit;
		text-align: left;
	}
	.sy-list-navigation-row:first-child {
		border-top: 0;
	}
	.sy-list-navigation-row:active {
		background: var(--sy-surface--well);
	}
	.sy-list-navigation-row__copy {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: 3px;
		min-width: 0;
	}
	.sy-list-navigation-row strong {
		font-size: var(--sy-font-size--mobile-medium);
	}
	.sy-list-navigation-row small {
		color: var(--sy-text--secondary);
		font-size: var(--sy-font-size--mobile-small);
	}
</style>
