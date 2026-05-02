<script lang="ts">
	import { ChevronLeft, ChevronRight, X } from 'lucide-svelte';
	import DictionaryContent from '@/components/DictionaryContent/DictionaryContent.svelte';
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import type { SearchEntry } from '@/types/search.js';
	import { isMobile } from '@/utils/device.js';

	type PopoverPlacement = 'below' | 'above' | 'right' | 'left';

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
	const DESKTOP_GUTTER_PX = 16;
	const DESKTOP_OFFSET_PX = 10;
	let popoverElement = $state<HTMLElement | undefined>(undefined);

	const visible = $derived(Boolean(word));
	const showDots = $derived(results.length <= 8);

	const placement = $derived.by((): PopoverPlacement => {
		if (!anchor || mobile) {
			return 'below';
		}
		const spaceBelow = window.innerHeight - anchor.bottom - DESKTOP_GUTTER_PX;
		const spaceAbove = anchor.top - DESKTOP_GUTTER_PX;
		const spaceRight = window.innerWidth - anchor.right - DESKTOP_GUTTER_PX;
		const spaceLeft = anchor.left - DESKTOP_GUTTER_PX;
		const neededVertical = DESKTOP_HEIGHT_PX + DESKTOP_OFFSET_PX;
		const neededHorizontal = DESKTOP_WIDTH_PX + DESKTOP_OFFSET_PX;

		if (spaceBelow >= neededVertical) {
			return 'below';
		}
		if (spaceAbove >= neededVertical) {
			return 'above';
		}
		if (spaceRight >= neededHorizontal) {
			return 'right';
		}
		if (spaceLeft >= neededHorizontal) {
			return 'left';
		}
		return spaceBelow >= spaceAbove ? 'below' : 'above';
	});

	function clampHorizontal(value: number): number {
		return Math.min(
			window.innerWidth - DESKTOP_WIDTH_PX - DESKTOP_GUTTER_PX,
			Math.max(DESKTOP_GUTTER_PX, value)
		);
	}

	function clampVertical(value: number): number {
		return Math.min(
			window.innerHeight - DESKTOP_HEIGHT_PX - DESKTOP_GUTTER_PX,
			Math.max(DESKTOP_GUTTER_PX, value)
		);
	}

	const style = $derived.by(() => {
		if (!anchor || mobile) {
			return '';
		}
		const anchorCenterX = anchor.left + anchor.width / 2;
		const anchorCenterY = anchor.top + anchor.height / 2;
		let popLeft: number;
		let popTop: number;
		let originX: string;
		let originY: string;
		const customProps: string[] = [];

		switch (placement) {
			case 'below':
				popLeft = clampHorizontal(anchorCenterX - DESKTOP_WIDTH_PX / 2);
				popTop = anchor.bottom + DESKTOP_OFFSET_PX;
				customProps.push(`--popover-arrow-x:${anchorCenterX - popLeft}px`);
				originX = `${anchorCenterX - popLeft}px`;
				originY = '0';
				break;
			case 'above':
				popLeft = clampHorizontal(anchorCenterX - DESKTOP_WIDTH_PX / 2);
				popTop = Math.max(DESKTOP_GUTTER_PX, anchor.top - DESKTOP_HEIGHT_PX - DESKTOP_OFFSET_PX);
				customProps.push(`--popover-arrow-x:${anchorCenterX - popLeft}px`);
				originX = `${anchorCenterX - popLeft}px`;
				originY = '100%';
				break;
			case 'right':
				popLeft = anchor.right + DESKTOP_OFFSET_PX;
				popTop = clampVertical(anchorCenterY - DESKTOP_HEIGHT_PX / 2);
				customProps.push(`--popover-arrow-y:${anchorCenterY - popTop}px`);
				originX = '0';
				originY = `${anchorCenterY - popTop}px`;
				break;
			case 'left':
				popLeft = Math.max(DESKTOP_GUTTER_PX, anchor.left - DESKTOP_WIDTH_PX - DESKTOP_OFFSET_PX);
				popTop = clampVertical(anchorCenterY - DESKTOP_HEIGHT_PX / 2);
				customProps.push(`--popover-arrow-y:${anchorCenterY - popTop}px`);
				originX = '100%';
				originY = `${anchorCenterY - popTop}px`;
				break;
		}

		return [
			`left:${popLeft}px`,
			`top:${popTop}px`,
			`width:${DESKTOP_WIDTH_PX}px`,
			`height:${DESKTOP_HEIGHT_PX}px`,
			`transform-origin:${originX} ${originY}`,
			...customProps,
		].join(';');
	});

	$effect(() => {
		if (!visible || !popoverElement) {
			return undefined;
		}
		let removed = false;
		const handleOutsideClick = (event: MouseEvent) => {
			if (popoverElement && !event.composedPath().includes(popoverElement)) {
				onclose();
			}
		};
		const timer = setTimeout(() => {
			if (!removed) {
				document.addEventListener('click', handleOutsideClick, { capture: true });
			}
		}, 0);
		return () => {
			removed = true;
			clearTimeout(timer);
			document.removeEventListener('click', handleOutsideClick, { capture: true });
		};
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
	<div
		bind:this={popoverElement}
		class="dictionary-popover"
		class:dictionary-popover--mobile={mobile}
		class:dictionary-popover--below={placement === 'below'}
		class:dictionary-popover--above={placement === 'above'}
		class:dictionary-popover--right={placement === 'right'}
		class:dictionary-popover--left={placement === 'left'}
		{style}
	>
		<div class="dictionary-popover__header">
			<span class="dictionary-popover__title">Dictionary</span>
			<SyButton style="ghost" size="small" onclick={onclose}>
				<X size="16" />
			</SyButton>
		</div>
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
									class:dictionary-popover__result-dot--active={dotIndex === resultIndex}
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
{/if}

<style>
	@keyframes popover-enter {
		from {
			opacity: 0;
			transform: scale(0.85);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}

	.dictionary-popover {
		position: fixed;
		background: var(--sy-color--white);
		border-radius: var(--sy-border-radius);
		box-shadow:
			0 8px 32px rgb(0 0 0 / 18%),
			0 2px 8px rgb(0 0 0 / 12%);
		border: var(--sy-mobile-surface-border);
		z-index: var(--sy-z-index--top-3);
		display: flex;
		flex-direction: column;
		animation: popover-enter 0.2s cubic-bezier(0.4, 0, 0.2, 1) forwards;
	}

	.dictionary-popover::before {
		content: '';
		position: absolute;
		border: 8px solid transparent;
		pointer-events: none;
	}

	.dictionary-popover--below::before {
		top: -16px;
		left: var(--popover-arrow-x, 50%);
		transform: translateX(-50%);
		border-bottom-color: var(--sy-color--white);
	}

	.dictionary-popover--above::before {
		bottom: -16px;
		left: var(--popover-arrow-x, 50%);
		transform: translateX(-50%);
		border-top-color: var(--sy-color--white);
	}

	.dictionary-popover--right::before {
		left: -16px;
		top: var(--popover-arrow-y, 50%);
		transform: translateY(-50%);
		border-right-color: var(--sy-color--white);
	}

	.dictionary-popover--left::before {
		right: -16px;
		top: var(--popover-arrow-y, 50%);
		transform: translateY(-50%);
		border-left-color: var(--sy-color--white);
	}

	.dictionary-popover--mobile {
		left: 0;
		right: 0;
		bottom: 0;
		width: auto;
		height: auto;
		max-height: 72vh;
		border-radius: var(--sy-mobile-space--extra-large) var(--sy-mobile-space--extra-large) 0 0;
		animation: none;
	}

	.dictionary-popover--mobile::before {
		display: none;
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
