<script lang="ts">
	import { ChevronLeft, ChevronRight, X } from 'lucide-svelte';
	import DictionaryContent from '@/components/DictionaryContent/DictionaryContent.svelte';
	import SyPopover from '@/components/SyPopover/SyPopover.svelte';
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import type { SearchEntry } from '@/types/search.js';
	import type { BookmarkListMembershipEvent } from '@/types/bookmarks.js';
	import { isMobileLayout } from '@/utils/device.js';
	import {
		normalizeDictionaryLookupRequest,
		type DictionaryLookupRequest,
	} from '@/composables/dictionaryPopover.svelte.js';

	const {
		id = undefined,
		returnFocus = undefined,
		word = undefined,
		results = [],
		resultIndex = 0,
		lists = [],
		anchor = undefined,
		reopenKey = undefined,
		onselect = () => {},
		onclose = () => {},
		onlink = undefined,
		onmembershipchange = undefined,
	}: {
		id?: string;
		returnFocus?: HTMLElement;
		word?: SearchEntry;
		results?: SearchEntry[];
		resultIndex?: number;
		lists?: string[];
		anchor?: DOMRect;
		reopenKey?: number | string;
		onselect?: (_index: number) => void;
		onclose?: () => void;
		onlink?: (_request: DictionaryLookupRequest) => void;
		onmembershipchange?: (_event: BookmarkListMembershipEvent) => void;
	} = $props();

	const mobile = isMobileLayout();
	const DESKTOP_WIDTH_PX = 420;
	const DESKTOP_HEIGHT_PX = 380;
	const MAX_DOT_RESULTS = 8;

	const visible = $derived(Boolean(word));
	const showDots = $derived(!mobile && results.length <= MAX_DOT_RESULTS);
	const handleContentLink = (request: DictionaryLookupRequest) => {
		// Keep nested popover lookups anchored to the original trigger instead of
		// moving the popover arrow to a link inside the popover itself, while
		// retaining a reference's direct lexical lookup when one is available.
		const lookup = normalizeDictionaryLookupRequest(request);
		onlink?.({
			text: lookup.text,
			...(lookup.lexicalId ? { lexicalId: lookup.lexicalId } : {}),
		});
	};
</script>

<SyPopover
	{id}
	{returnFocus}
	{visible}
	{anchor}
	{reopenKey}
	width={DESKTOP_WIDTH_PX}
	height={DESKTOP_HEIGHT_PX}
	mobileTitle="Dictionary"
	{onclose}
>
	<div class="dictionary-popover__body" data-walkthrough-secondary="true">
		{#if !mobile}
			<div class="dictionary-popover__header">
				<span class="dictionary-popover__title">Dictionary</span>
				<SyButton
					style="ghost"
					size="small"
					aria-label="Close dictionary"
					onclick={onclose}
				>
					<X size="16" />
				</SyButton>
			</div>
		{/if}
		{#if results.length > 1}
			<div
				role="group"
				class="dictionary-popover__results-nav"
				aria-label="Dictionary results"
			>
				<SyButton
					style="ghost"
					size="small"
					aria-label="Previous dictionary result"
					disabled={resultIndex <= 0}
					onclick={() => onselect(resultIndex - 1)}
				>
					<ChevronLeft size="16" />
				</SyButton>
				<div class="dictionary-popover__result-indicator">
					<span class="dictionary-popover__result-label" role="status" aria-atomic="true">
						Result {resultIndex + 1} of {results.length}
					</span>
					{#if showDots}
						<div class="dictionary-popover__result-dots">
							{#each results as _, dotIndex (dotIndex)}
								<button
									type="button"
									aria-current={dotIndex === resultIndex ? 'true' : undefined}
									class="dictionary-popover__result-dot"
									class:dictionary-popover__result-dot--active={dotIndex ===
										resultIndex}
									onclick={() => onselect(dotIndex)}
									aria-label="Result {dotIndex + 1}"
								></button>
							{/each}
						</div>
					{/if}
				</div>
				<SyButton
					style="ghost"
					size="small"
					aria-label="Next dictionary result"
					disabled={resultIndex >= results.length - 1}
					onclick={() => onselect(resultIndex + 1)}
				>
					<ChevronRight size="16" />
				</SyButton>
			</div>
		{/if}
		<div class="dictionary-popover__content">
			<DictionaryContent
				{word}
				{lists}
				backgroundColor="white"
				fixedActions={true}
				separateTraditionalCharacters={true}
				onlink={handleContentLink}
				{onmembershipchange}
			/>
		</div>
	</div>
</SyPopover>

<style>
	.dictionary-popover__body {
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 0;
	}

	.dictionary-popover__header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--sy-space) var(--sy-space--large);
		border-bottom: var(--sy-border);
		flex-shrink: 0;
	}

	.dictionary-popover__title {
		font-family: var(--sy-font-family);
		font-weight: var(--sy-font-weight--medium);
		color: var(--sy-text--muted);
	}

	.dictionary-popover__results-nav {
		display: flex;
		align-items: center;
		gap: var(--sy-space);
		padding: var(--sy-space) var(--sy-space--large);
		border-bottom: var(--sy-border);
		background: var(--sy-color--white);
		flex-shrink: 0;
	}

	.dictionary-popover__result-indicator {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--sy-space--small);
	}

	.dictionary-popover__result-label {
		font-family: var(--sy-font-family);
		font-size: var(--sy-font-size--small);
		color: var(--sy-text--muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: normal;
		max-width: 100%;
		text-align: center;
	}

	.dictionary-popover__result-dots {
		display: flex;
		gap: 0;
		flex-wrap: wrap;
		justify-content: center;
	}

	.dictionary-popover__result-dot {
		display: grid;
		place-items: center;
		width: 24px;
		height: 24px;
		border: 0;
		padding: 0;
		background: transparent;
		cursor: pointer;
	}
	.dictionary-popover__result-dot::after {
		content: '';
		box-sizing: border-box;
		width: 6px;
		height: 6px;
		border-radius: 50%;
		border: 1px solid var(--sy-control--border);
		background: transparent;
		transition: background var(--sy-transition-duration);
	}
	.dictionary-popover__result-dot--active::after {
		background: var(--sy-text--blue);
		border-color: var(--sy-text--blue);
	}

	.dictionary-popover__content {
		overflow-y: auto;
		min-height: 0;
		flex: 1;
	}
</style>
