<script lang="ts" generics="T extends { id: string | number }">
	import type { Snippet } from 'svelte';
	import { slide } from 'svelte/transition';
	import { ChevronDown, ExternalLink } from 'lucide-svelte';

	const EXTERNAL_LINK_ICON_SIZE = 14;
	const CHEVRON_ICON_SIZE = 16;
	const DETAIL_TRANSITION_MS = 240;

	interface Props {
		items?: T[];
		emptyText?: string;
		header: Snippet<[T]>;
		detail: Snippet<[T]>;
		itemUrl?: (item: T) => string | undefined;
		onlinkclick?: (event: MouseEvent, item: T) => void;
	}

	const {
		items = [],
		emptyText = 'No items.',
		header,
		detail,
		itemUrl,
		onlinkclick,
	}: Props = $props();

	const listId = $props.id();
	const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
	const supportsAnimation = typeof Element.prototype.animate === 'function';
	let expandedId = $state<string | number | null>(null);

	const toggle = (id: string | number) => {
		expandedId = expandedId === id ? null : id;
	};
</script>

{#if items.length === 0}
	<p class="sy-collapsible-list--empty">{emptyText}</p>
{:else}
	<div class="sy-collapsible-list">
		<div class="sy-collapsible-list--surface">
			{#each items as item, index (item.id)}
				{@const url = itemUrl?.(item)}
				<div class="sy-collapsible-list--item">
					{#if url}
						<a
							class="sy-collapsible-list--header"
							href={url}
							onclick={(event) => onlinkclick?.(event, item)}
						>
							{@render header(item)}
							<span class="sy-collapsible-list--chevron" aria-hidden="true">
								<ExternalLink size={EXTERNAL_LINK_ICON_SIZE} />
							</span>
						</a>
					{:else}
						<button
							type="button"
							class="sy-collapsible-list--header"
							aria-expanded={expandedId === item.id}
							aria-controls={`${listId}-${index}`}
							onclick={() => toggle(item.id)}
						>
							{@render header(item)}
							<span class="sy-collapsible-list--chevron" aria-hidden="true">
								<ChevronDown size={CHEVRON_ICON_SIZE} />
							</span>
						</button>
						{#if expandedId === item.id}
							<div
								id={`${listId}-${index}`}
								class="sy-collapsible-list--detail"
								transition:slide={{
									duration:
										reducedMotion?.matches || !supportsAnimation
											? 0
											: DETAIL_TRANSITION_MS,
								}}
							>
								<div class="sy-collapsible-list--detail-content">
									{@render detail(item)}
								</div>
							</div>
						{/if}
					{/if}
				</div>
			{/each}
		</div>
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
		flex: 1;
		min-height: 200px;
		overflow-y: auto;
		padding: 4px;
	}

	.sy-collapsible-list--surface {
		background: var(--sy-surface--content);
		border-radius: var(--sy-border-radius--content-list);
		box-shadow: var(--sy-shadow--content);
		overflow: hidden;
		flex-shrink: 0;
	}
	.sy-collapsible-list--item {
		padding: 4px 6px;
	}
	.sy-collapsible-list--item + .sy-collapsible-list--item {
		border-top: var(--sy-border);
	}

	.sy-collapsible-list--header {
		display: flex;
		align-items: center;
		gap: var(--sy-space--large);
		width: 100%;
		min-height: 44px;
		padding: 10px;
		background: none;
		border: none;
		border-radius: 7px;
		cursor: pointer;
		color: inherit;
		font-family: var(--sy-font-family);
		font-size: var(--sy-font-size--small);
		text-align: left;
		text-decoration: none;
		box-sizing: border-box;
	}

	.sy-collapsible-list--header:focus-visible,
	.sy-collapsible-list--header:global(.sy-focus-visible) {
		outline-offset: calc(-1 * var(--sy-focus-width));
	}
	.sy-collapsible-list--header:hover {
		background-color: var(--sy-color--grey-2);
	}

	.sy-collapsible-list--chevron {
		color: var(--sy-text--light);
		flex-shrink: 0;
		margin-left: auto;
	}
	.sy-collapsible-list--chevron :global(svg) {
		transition: transform 220ms ease;
	}
	.sy-collapsible-list--header[aria-expanded='true'] .sy-collapsible-list--chevron :global(svg) {
		transform: rotate(180deg);
	}

	.sy-collapsible-list--detail {
		padding: 8px 10px 10px;
	}
	.sy-collapsible-list--detail-content {
		padding: 12px 14px;
		border-radius: 7px;
		background: var(--sy-surface--well);
	}
	@media (prefers-reduced-motion: reduce) {
		.sy-collapsible-list--chevron :global(svg) {
			transition: none;
		}
	}
</style>
