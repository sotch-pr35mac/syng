<script lang="ts" generics="T extends { id: string | number }">
	import type { Snippet } from 'svelte';

	interface Props {
		items?: T[];
		emptyText?: string;
		header: Snippet<[T]>;
		detail: Snippet<[T]>;
	}

	const { items = [], emptyText = 'No items.', header, detail }: Props = $props();

	let expandedId = $state<string | number | null>(null);

	const toggle = (id: string | number) => {
		expandedId = expandedId === id ? null : id;
	};
</script>

{#if items.length === 0}
	<p class="sy-collapsible-list--empty">{emptyText}</p>
{:else}
	<div class="sy-collapsible-list">
		{#each items as item (item.id)}
			<div class="sy-collapsible-list--item">
				<button class="sy-collapsible-list--header" onclick={() => toggle(item.id)}>
					{@render header(item)}
					<span class="sy-collapsible-list--chevron">
						{expandedId === item.id ? '▲' : '▼'}
					</span>
				</button>
				{#if expandedId === item.id}
					<div class="sy-collapsible-list--detail">
						{@render detail(item)}
					</div>
				{/if}
			</div>
		{/each}
	</div>
{/if}

<style>
	.sy-collapsible-list--empty {
		margin: 0;
		font-size: var(--sy-font-size--small);
		color: var(--sy-text--light);
	}

	.sy-collapsible-list {
		display: flex;
		flex-direction: column;
		gap: var(--sy-space);
		flex: 1;
		min-height: 200px;
		overflow-y: auto;
	}

	.sy-collapsible-list--item {
		border: var(--sy-border);
		border-radius: var(--sy-border-radius);
		overflow: hidden;
		flex-shrink: 0;
	}

	.sy-collapsible-list--header {
		display: flex;
		align-items: center;
		gap: var(--sy-space--large);
		width: 100%;
		padding: var(--sy-space--large);
		background: none;
		border: none;
		cursor: pointer;
		color: inherit;
		font-family: var(--sy-font-family);
		font-size: var(--sy-font-size--small);
		text-align: left;
	}

	.sy-collapsible-list--header:hover {
		background-color: var(--sy-color--grey-2);
	}

	.sy-collapsible-list--chevron {
		color: var(--sy-text--light);
		font-size: 10px;
		flex-shrink: 0;
		margin-left: auto;
	}

	.sy-collapsible-list--detail {
		border-top: var(--sy-border);
	}
</style>
