<script lang="ts">
	import { ChevronLeft, ChevronRight, X } from 'lucide-svelte';
	import DictionaryContent from '@/components/DictionaryContent/DictionaryContent.svelte';
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
	const DESKTOP_GUTTER_PX = 16;
	const DESKTOP_OFFSET_PX = 12;
	const visible = $derived(Boolean(word));
	const style = $derived.by(() => {
		if (!anchor || mobile) {
			return '';
		}
		const left = Math.min(
			window.innerWidth - DESKTOP_WIDTH_PX - DESKTOP_GUTTER_PX,
			Math.max(DESKTOP_GUTTER_PX, anchor.left + anchor.width / 2 - DESKTOP_WIDTH_PX / 2)
		);
		const top =
			anchor.bottom + DESKTOP_OFFSET_PX + DESKTOP_WIDTH_PX > window.innerHeight
				? Math.max(DESKTOP_GUTTER_PX, anchor.top - DESKTOP_WIDTH_PX - DESKTOP_OFFSET_PX)
				: anchor.bottom + DESKTOP_OFFSET_PX;
		return `left:${left}px; top:${top}px; width:${DESKTOP_WIDTH_PX}px;`;
	});

	function getResultLabel(result: SearchEntry): string {
		const headword =
			result.simplified === result.traditional
				? result.simplified
				: `${result.simplified} / ${result.traditional}`;
		return `${headword} ${result.pinyin_marks}`;
	}
</script>

{#if visible}
	<button class="dictionary-popover__backdrop" aria-label="Close dictionary" onclick={onclose}>
	</button>
	<div class="dictionary-popover" class:dictionary-popover--mobile={mobile} {style}>
		<div class="dictionary-popover__header">
			<span class="dictionary-popover__title">Dictionary</span>
			<SyButton style="ghost" size="small" onclick={onclose}>
				<X size="16" />
			</SyButton>
		</div>
		{#if results.length > 1}
			<div class="dictionary-popover__results" aria-label="Dictionary results">
				<SyButton
					style="ghost"
					size="small"
					disabled={resultIndex <= 0}
					onclick={() => onselect(resultIndex - 1)}
				>
					<ChevronLeft size="16" />
				</SyButton>
				<div class="dictionary-popover__result-tabs">
					{#each results as result, index (`${result.hash}-${index}`)}
						<button
							class="dictionary-popover__result-tab"
							class:dictionary-popover__result-tab--active={index === resultIndex}
							onclick={() => onselect(index)}
						>
							<span>{getResultLabel(result)}</span>
							<small>{result.english[0]}</small>
						</button>
					{/each}
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
{/if}

<style>
	.dictionary-popover {
		position: fixed;
		max-height: min(620px, calc(100vh - 32px));
		background: var(--sy-color--white);
		border-radius: var(--sy-border-radius);
		box-shadow: var(--sy-mobile-overlay-shadow);
		border: var(--sy-mobile-surface-border);
		overflow: hidden;
		z-index: var(--sy-z-index--top-3);
		display: flex;
		flex-direction: column;
	}

	.dictionary-popover--mobile {
		left: 0;
		right: 0;
		bottom: 0;
		width: auto;
		max-height: 72vh;
		border-radius: var(--sy-mobile-space--extra-large) var(--sy-mobile-space--extra-large) 0 0;
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

	.dictionary-popover__results {
		display: grid;
		grid-template-columns: 36px minmax(0, 1fr) 36px;
		align-items: center;
		gap: var(--sy-space);
		padding: var(--sy-space);
		border-bottom: var(--sy-border);
		background: var(--sy-color--grey-1);
	}

	.dictionary-popover__result-tabs {
		display: flex;
		gap: var(--sy-space);
		overflow-x: auto;
		min-width: 0;
	}

	.dictionary-popover__result-tab {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		min-width: 136px;
		max-width: 180px;
		padding: var(--sy-space);
		border: var(--sy-border);
		border-radius: var(--sy-border-radius);
		background: var(--sy-color--white);
		color: var(--sy-color--grey-4);
		font-family: var(--sy-font-family);
		text-align: left;
		cursor: pointer;
	}

	.dictionary-popover__result-tab--active {
		border-color: var(--sy-color--blue);
		color: var(--sy-color--blue);
	}

	.dictionary-popover__result-tab span,
	.dictionary-popover__result-tab small {
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.dictionary-popover__result-tab small {
		margin-top: var(--sy-space--extra-small);
		color: var(--sy-color--grey-3);
	}

	.dictionary-popover__content {
		overflow-y: auto;
		min-height: 0;
	}

	.dictionary-popover__backdrop {
		position: fixed;
		inset: 0;
		border: 0;
		background: transparent;
		z-index: var(--sy-z-index--top-2);
	}
</style>
