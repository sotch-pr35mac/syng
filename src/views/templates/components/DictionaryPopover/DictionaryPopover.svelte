<script lang="ts">
	import { ChevronLeft, ChevronRight, X } from 'lucide-svelte';
	import DictionaryContent from '@/components/DictionaryContent/DictionaryContent.svelte';
	import SyPopover from '@/components/SyPopover/SyPopover.svelte';
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import type { SearchEntry } from '@/types/search.js';
	import { isMobile } from '@/utils/device.js';

	const {
		word = undefined,
		results = [],
		resultIndex = 0,
		lists = [],
		anchor = undefined,
		onselect = () => {},
		onclose = () => {},
	}: {
		word?: SearchEntry;
		results?: SearchEntry[];
		resultIndex?: number;
		lists?: string[];
		anchor?: DOMRect;
		onselect?: (_index: number) => void;
		onclose?: () => void;
	} = $props();

	const mobile = isMobile();
	const DESKTOP_WIDTH_PX = 420;
	const DESKTOP_HEIGHT_PX = 380;
	const MAX_DOT_RESULTS = 8;

	const visible = $derived(Boolean(word));
	const showDots = $derived(results.length <= MAX_DOT_RESULTS);

	function getResultLabel(result: SearchEntry): string {
		const headword =
			result.simplified === result.traditional
				? result.simplified
				: `${result.simplified} / ${result.traditional}`;
		return `${headword} ${result.pinyin_marks}`;
	}
</script>

<SyPopover
	{visible}
	{anchor}
	width={DESKTOP_WIDTH_PX}
	height={DESKTOP_HEIGHT_PX}
	mobileTitle="Dictionary"
	{onclose}
>
	<div class="dictionary-popover__body">
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
			<div class="dictionary-popover__results-nav" aria-label="Dictionary results">
				<SyButton
					style="ghost"
					size="small"
					disabled={resultIndex <= 0}
					onclick={() => onselect(resultIndex - 1)}
				>
					<ChevronLeft size="16" />
				</SyButton>
				<div class="dictionary-popover__result-indicator">
					<span class="dictionary-popover__result-label">
						{getResultLabel(results[resultIndex])} ({resultIndex + 1} of {results.length})
					</span>
					{#if showDots}
						<div class="dictionary-popover__result-dots">
							{#each results as _, dotIndex (dotIndex)}
								<button
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
					disabled={resultIndex >= results.length - 1}
					onclick={() => onselect(resultIndex + 1)}
				>
					<ChevronRight size="16" />
				</SyButton>
			</div>
		{/if}
		<div class="dictionary-popover__content">
			<DictionaryContent {word} {lists} backgroundColor="white" fixedActions={true} />
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
		color: var(--sy-color--grey-4);
	}

	.dictionary-popover__results-nav {
		display: flex;
		align-items: center;
		gap: var(--sy-space);
		padding: var(--sy-space) var(--sy-space--large);
		border-bottom: var(--sy-border);
		background: var(--sy-color--grey-1);
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
		font-size: 0.85rem;
		color: var(--sy-color--grey-4);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 100%;
		text-align: center;
	}

	.dictionary-popover__result-dots {
		display: flex;
		gap: var(--sy-space);
		justify-content: center;
	}

	.dictionary-popover__result-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		border: 0;
		padding: 0;
		background: var(--sy-color--grey-5, #ccc);
		cursor: pointer;
		transition: background var(--sy-transition-duration);
	}

	.dictionary-popover__result-dot--active {
		background: var(--sy-color--blue);
	}

	.dictionary-popover__content {
		overflow-y: auto;
		min-height: 0;
		flex: 1;
	}
</style>
