<script lang="ts">
	import type { Snippet } from 'svelte';
	import { X } from 'lucide-svelte';
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import SySnapSheet from '@/components/SySnapSheet/SySnapSheet.svelte';
	import type { SheetSnap } from '@/types/snapSheet.js';
	import { isMobileLayout } from '@/utils/device.js';

	type PopoverPlacement = 'below' | 'above' | 'right' | 'left';
	type PopoverHorizontalAlign = 'center' | 'start' | 'end';

	const {
		visible = false,
		anchor = undefined,
		ignoreElement = undefined,
		width = undefined,
		height = undefined,
		gutter = 16,
		offset = 10,
		horizontalAlign = 'center',
		mobileTitle = 'Options',
		mobileSnap = 'partial',
		children,
		onclose = () => {},
	}: {
		visible?: boolean;
		anchor?: DOMRect;
		ignoreElement?: HTMLElement;
		width?: number;
		height?: number;
		gutter?: number;
		offset?: number;
		horizontalAlign?: PopoverHorizontalAlign;
		mobileTitle?: string;
		mobileSnap?: SheetSnap;
		children?: Snippet;
		onclose?: () => void;
	} = $props();

	const mobile = isMobileLayout();
	let popoverElement = $state<HTMLElement | undefined>(undefined);
	let measuredWidth = $state(0);
	let measuredHeight = $state(0);
	const effectiveWidth = $derived(width ?? measuredWidth);
	const effectiveHeight = $derived(height ?? measuredHeight);

	const placement = $derived.by((): PopoverPlacement => {
		if (!anchor || mobile || !effectiveWidth || !effectiveHeight) {
			return 'below';
		}
		const spaceBelow = window.innerHeight - anchor.bottom - gutter;
		const spaceAbove = anchor.top - gutter;
		const spaceRight = window.innerWidth - anchor.right - gutter;
		const spaceLeft = anchor.left - gutter;
		const neededVertical = effectiveHeight + offset;
		const neededHorizontal = effectiveWidth + offset;

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
		const maximumLeft = Math.max(gutter, window.innerWidth - effectiveWidth - gutter);
		return Math.min(maximumLeft, Math.max(gutter, value));
	}

	function clampVertical(value: number): number {
		const maximumTop = Math.max(gutter, window.innerHeight - effectiveHeight - gutter);
		return Math.min(maximumTop, Math.max(gutter, value));
	}

	function getHorizontalPosition(anchorCenterX: number): number {
		if (horizontalAlign === 'start') {
			return clampHorizontal(anchor.left);
		}
		if (horizontalAlign === 'end') {
			return clampHorizontal(anchor.right - effectiveWidth);
		}
		return clampHorizontal(anchorCenterX - effectiveWidth / 2);
	}

	const popoverStyle = $derived.by(() => {
		if (!anchor || mobile) {
			return '';
		}
		const anchorCenterX = anchor.left + anchor.width / 2;
		const anchorCenterY = anchor.top + anchor.height / 2;
		let popLeft: number;
		let popTop: number;
		let originX: string;
		let originY: string;
		const hasMeasuredSize = Boolean(effectiveWidth && effectiveHeight);
		const customProps: string[] = [
			`max-width:calc(100vw - ${gutter * 2}px)`,
			`max-height:calc(100vh - ${gutter * 2}px)`,
		];
		if (width !== undefined) {
			customProps.push(`width:${width}px`);
		} else {
			customProps.push('width:fit-content');
		}
		if (height !== undefined) {
			customProps.push(`height:${height}px`);
		}
		if (!hasMeasuredSize) {
			customProps.push('visibility:hidden');
		}

		switch (placement) {
			case 'below':
				popLeft = getHorizontalPosition(anchorCenterX);
				popTop = anchor.bottom + offset;
				customProps.push(`--sy-popover-arrow-x:${anchorCenterX - popLeft}px`);
				originX = `${anchorCenterX - popLeft}px`;
				originY = '0';
				break;
			case 'above':
				popLeft = getHorizontalPosition(anchorCenterX);
				popTop = Math.max(gutter, anchor.top - effectiveHeight - offset);
				customProps.push(`--sy-popover-arrow-x:${anchorCenterX - popLeft}px`);
				originX = `${anchorCenterX - popLeft}px`;
				originY = '100%';
				break;
			case 'right':
				popLeft = anchor.right + offset;
				popTop = clampVertical(anchorCenterY - effectiveHeight / 2);
				customProps.push(`--sy-popover-arrow-y:${anchorCenterY - popTop}px`);
				originX = '0';
				originY = `${anchorCenterY - popTop}px`;
				break;
			case 'left':
				popLeft = Math.max(gutter, anchor.left - effectiveWidth - offset);
				popTop = clampVertical(anchorCenterY - effectiveHeight / 2);
				customProps.push(`--sy-popover-arrow-y:${anchorCenterY - popTop}px`);
				originX = '100%';
				originY = `${anchorCenterY - popTop}px`;
				break;
		}

		return [
			`left:${popLeft}px`,
			`top:${popTop}px`,
			`transform-origin:${originX} ${originY}`,
			...customProps,
		].join(';');
	});

	$effect(() => {
		if (!visible || mobile || !popoverElement) {
			return undefined;
		}
		const updateMeasuredSize = () => {
			if (!popoverElement) {
				return;
			}
			const popoverRect = popoverElement.getBoundingClientRect();
			measuredWidth = popoverRect.width;
			measuredHeight = popoverRect.height;
		};
		updateMeasuredSize();
		if (typeof ResizeObserver === 'undefined') {
			return undefined;
		}
		const resizeObserver = new ResizeObserver(updateMeasuredSize);
		resizeObserver.observe(popoverElement);
		return () => {
			resizeObserver.disconnect();
		};
	});

	$effect(() => {
		if (!visible || mobile || !popoverElement) {
			return undefined;
		}
		let removed = false;
		const handleOutsideClick = (event: MouseEvent) => {
			const eventPath = event.composedPath();
			if (popoverElement && eventPath.includes(popoverElement)) {
				return;
			}
			if (ignoreElement && eventPath.includes(ignoreElement)) {
				return;
			}
			onclose();
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
</script>

{#if visible}
	{#if mobile}
		<SySnapSheet initialSnap={mobileSnap}>
			<div class="sy-popover__mobile-header">
				<span class="sy-popover__mobile-title">{mobileTitle}</span>
				<SyButton style="ghost" size="small" aria-label="Close" onclick={onclose}>
					<X size="16" />
				</SyButton>
			</div>
			<div class="sy-popover__mobile-content">
				{@render children?.()}
			</div>
		</SySnapSheet>
	{:else}
		<div
			bind:this={popoverElement}
			class="sy-popover"
			class:sy-popover--below={placement === 'below'}
			class:sy-popover--above={placement === 'above'}
			class:sy-popover--right={placement === 'right'}
			class:sy-popover--left={placement === 'left'}
			style={popoverStyle}
		>
			<div class="sy-popover__content">
				{@render children?.()}
			</div>
		</div>
	{/if}
{/if}

<style>
	@keyframes sy-popover-enter {
		from {
			opacity: 0;
			transform: scale(0.85);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}

	.sy-popover {
		position: fixed;
		display: flex;
		flex-direction: column;
		box-sizing: border-box;
		background: var(--sy-color--white);
		border: var(--sy-border);
		border-radius: var(--sy-border-radius);
		box-shadow: var(--sy-shadow--active);
		z-index: var(--sy-z-index--top-3);
		animation: sy-popover-enter 0.2s cubic-bezier(0.4, 0, 0.2, 1) forwards;
	}

	.sy-popover__content {
		display: flex;
		flex-direction: column;
		flex: 1;
		width: 100%;
		min-height: 0;
		min-width: 0;
		max-width: inherit;
		max-height: inherit;
		box-sizing: border-box;
		overflow: auto;
	}

	.sy-popover::before {
		content: '';
		position: absolute;
		border: 8px solid transparent;
		pointer-events: none;
	}

	.sy-popover--below::before {
		top: -16px;
		left: var(--sy-popover-arrow-x, 50%);
		transform: translateX(-50%);
		border-bottom-color: var(--sy-color--white);
	}

	.sy-popover--above::before {
		bottom: -16px;
		left: var(--sy-popover-arrow-x, 50%);
		transform: translateX(-50%);
		border-top-color: var(--sy-color--white);
	}

	.sy-popover--right::before {
		left: -16px;
		top: var(--sy-popover-arrow-y, 50%);
		transform: translateY(-50%);
		border-right-color: var(--sy-color--white);
	}

	.sy-popover--left::before {
		right: -16px;
		top: var(--sy-popover-arrow-y, 50%);
		transform: translateY(-50%);
		border-left-color: var(--sy-color--white);
	}

	.sy-popover__mobile-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--sy-space) var(--sy-space--large);
		border-bottom: var(--sy-border);
		flex-shrink: 0;
	}

	.sy-popover__mobile-title {
		font-family: var(--sy-font-family);
		font-weight: var(--sy-font-weight--medium);
		color: var(--sy-color--grey-4);
	}

	.sy-popover__mobile-content {
		min-height: 0;
		overflow-y: auto;
		flex: 1;
	}
</style>
