<script lang="ts">
	import { untrack, type Snippet } from 'svelte';
	import { X } from 'lucide-svelte';
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import SySnapSheet from '@/components/SySnapSheet/SySnapSheet.svelte';
	import type { SheetSnap } from '@/types/snapSheet.js';
	import { isMobileLayout } from '@/utils/device.js';
	import { overlayFocus } from '@/actions/overlayFocus.js';
	import { walkthroughTarget } from '@/actions/walkthroughTarget.svelte.js';
	import type { WalkthroughTargetId } from '@/types/walkthrough.js';

	type PopoverPlacement = 'below' | 'above' | 'right' | 'left';
	type PopoverHorizontalAlign = 'center' | 'start' | 'end';

	const {
		id = undefined,
		visible = false,
		anchor = undefined,
		ignoreElement = undefined,
		width = undefined,
		height = undefined,
		gutter = 16,
		offset = 10,
		horizontalAlign = 'center',
		mobileTitle = 'Options',
		hideMobileHeader = false,
		onback = undefined,
		accessibleName = undefined,
		returnFocus = undefined,
		mobileSnap = 'partial',
		reopenKey = undefined,
		animateFromAnchor = false,
		guideTarget = undefined,
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
		hideMobileHeader?: boolean;
		onback?: () => void;
		accessibleName?: string;
		returnFocus?: HTMLElement;
		mobileSnap?: SheetSnap;
		reopenKey?: number | string;
		animateFromAnchor?: boolean;
		id?: string;
		guideTarget?: WalkthroughTargetId;
		children?: Snippet;
		onclose?: () => void;
	} = $props();

	const mobile = isMobileLayout();
	const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
	let mobileSheet = $state<SySnapSheet | undefined>(undefined);
	let mobileRendered = $state(untrack(() => visible));
	let previouslyVisible = untrack(() => visible);
	let desktopRendered = $state(untrack(() => visible));
	let desktopOpening = $state(untrack(() => visible) && !reducedMotion?.matches);
	let desktopClosing = $state(false);
	let openingFrame = 0;
	// Owners clear the anchor when closing; keep its last position until the exit finishes.
	let retainedAnchor = $state<DOMRect | undefined>(untrack(() => anchor));
	const positionedAnchor = $derived(
		animateFromAnchor ? (anchor ?? (desktopRendered ? retainedAnchor : undefined)) : anchor
	);
	$effect(() => {
		if (visible && anchor) {
			retainedAnchor = anchor;
		}
	});
	export function dismiss(): void {
		if (mobile) {
			void mobileSheet?.dismiss();
		} else {
			onclose();
		}
	}
	$effect(() => {
		if (!mobile) {
			return;
		}
		if (visible) {
			mobileRendered = true;
			if (!previouslyVisible) {
				if (mobileSnap === 'full') {
					mobileSheet?.openFull();
				} else if (mobileSnap === 'partial') {
					mobileSheet?.openPartial();
				}
			}
		} else if (mobileRendered) {
			void mobileSheet?.dismiss();
		}
		previouslyVisible = visible;
	});
	$effect(() => {
		if (mobile || !animateFromAnchor) {
			return undefined;
		}
		if (visible) {
			desktopRendered = true;
			if (untrack(() => desktopClosing)) {
				desktopClosing = false;
				desktopOpening = false;
			} else if (reducedMotion?.matches) {
				desktopOpening = false;
			} else {
				desktopOpening = true;
				openingFrame = requestAnimationFrame(() => {
					openingFrame = requestAnimationFrame(() => {
						desktopOpening = false;
						openingFrame = 0;
					});
				});
			}
		} else if (untrack(() => desktopRendered)) {
			if (untrack(() => desktopOpening) || reducedMotion?.matches) {
				desktopRendered = false;
			} else {
				desktopClosing = true;
			}
		}
		return () => cancelAnimationFrame(openingFrame);
	});
	$effect(() => {
		if (mobile || !animateFromAnchor) {
			return undefined;
		}
		const finishReducedMotion = () => {
			if (reducedMotion?.matches) {
				desktopOpening = false;
				if (desktopClosing) {
					desktopRendered = false;
					desktopClosing = false;
				}
			}
		};
		reducedMotion?.addEventListener('change', finishReducedMotion);
		return () => reducedMotion?.removeEventListener('change', finishReducedMotion);
	});
	function finishDesktopClose(event: TransitionEvent): void {
		if (
			event.target === popoverElement &&
			event.propertyName === 'transform' &&
			desktopClosing &&
			!visible
		) {
			desktopRendered = false;
			desktopClosing = false;
		}
	}
	let popoverElement = $state<HTMLElement | undefined>(undefined);
	let measuredWidth = $state(0);
	let measuredHeight = $state(0);
	const effectiveWidth = $derived(width ?? measuredWidth);
	const effectiveHeight = $derived(height ?? measuredHeight);

	const placement = $derived.by((): PopoverPlacement => {
		if (!positionedAnchor || mobile || !effectiveWidth || !effectiveHeight) {
			return 'below';
		}
		const spaceBelow = window.innerHeight - positionedAnchor.bottom - gutter;
		const spaceAbove = positionedAnchor.top - gutter;
		const spaceRight = window.innerWidth - positionedAnchor.right - gutter;
		const spaceLeft = positionedAnchor.left - gutter;
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

	function getHorizontalPosition(anchorCenterX: number, positionedAnchor: DOMRect): number {
		if (horizontalAlign === 'start') {
			return clampHorizontal(positionedAnchor.left);
		}
		if (horizontalAlign === 'end') {
			return clampHorizontal(positionedAnchor.right - effectiveWidth);
		}
		return clampHorizontal(anchorCenterX - effectiveWidth / 2);
	}

	const popoverStyle = $derived.by(() => {
		if (!positionedAnchor || mobile) {
			return '';
		}
		const anchorCenterX = positionedAnchor.left + positionedAnchor.width / 2;
		const anchorCenterY = positionedAnchor.top + positionedAnchor.height / 2;
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
				popLeft = getHorizontalPosition(anchorCenterX, positionedAnchor);
				popTop = positionedAnchor.bottom + offset;
				customProps.push(`--sy-popover-arrow-x:${anchorCenterX - popLeft}px`);
				originX = `${anchorCenterX - popLeft}px`;
				originY = '0';
				break;
			case 'above':
				popLeft = getHorizontalPosition(anchorCenterX, positionedAnchor);
				popTop = Math.max(gutter, positionedAnchor.top - effectiveHeight - offset);
				customProps.push(`--sy-popover-arrow-x:${anchorCenterX - popLeft}px`);
				originX = `${anchorCenterX - popLeft}px`;
				originY = '100%';
				break;
			case 'right':
				popLeft = positionedAnchor.right + offset;
				popTop = clampVertical(anchorCenterY - effectiveHeight / 2);
				customProps.push(`--sy-popover-arrow-y:${anchorCenterY - popTop}px`);
				originX = '0';
				originY = `${anchorCenterY - popTop}px`;
				break;
			case 'left':
				popLeft = Math.max(gutter, positionedAnchor.left - effectiveWidth - offset);
				popTop = clampVertical(anchorCenterY - effectiveHeight / 2);
				customProps.push(`--sy-popover-arrow-y:${anchorCenterY - popTop}px`);
				originX = '100%';
				originY = `${anchorCenterY - popTop}px`;
				break;
		}
		if (animateFromAnchor) {
			originX = `${anchorCenterX - popLeft}px`;
			originY = `${anchorCenterY - popTop}px`;
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
			// The entrance animation scales the visual rectangle. Position auto-sized
			// popovers using their layout size so the final panel stays on screen.
			measuredWidth = popoverElement.offsetWidth;
			measuredHeight = popoverElement.offsetHeight;
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
</script>

{#if mobile ? mobileRendered : animateFromAnchor ? desktopRendered : visible}
	{#if mobile}
		<SySnapSheet
			bind:this={mobileSheet}
			dismissible
			{guideTarget}
			{id}
			initialSnap={mobileSnap}
			{onback}
			{reopenKey}
			accessibleName={accessibleName ?? mobileTitle}
			returnFocus={returnFocus ?? ignoreElement}
			onclose={() => {
				mobileRendered = false;
				if (visible) {
					onclose();
				}
			}}
		>
			{#if !hideMobileHeader}<div class="sy-popover__mobile-header">
					<span class="sy-popover__mobile-title">{mobileTitle}</span>
					<SyButton style="ghost" size="small" aria-label="Close" onclick={dismiss}>
						<X size="16" />
					</SyButton>
				</div>
			{/if}
			<div class="sy-popover__mobile-content">
				{@render children?.()}
			</div>
		</SySnapSheet>
	{:else}
		<div
			{id}
			bind:this={popoverElement}
			role="dialog"
			aria-label={accessibleName ?? mobileTitle}
			tabindex="-1"
			use:overlayFocus={{
				initialFocus: 'keyboard',
				returnFocus: returnFocus ?? ignoreElement,
				ignoreElement,
				closeOnOutside: true,
				onclose: (reason) => (reason === 'escape' && onback ? onback() : onclose()),
			}}
			use:walkthroughTarget={guideTarget}
			class="sy-popover"
			class:sy-popover--anchor-motion={animateFromAnchor}
			class:sy-popover--opening={desktopOpening}
			class:sy-popover--closing={desktopClosing}
			class:sy-popover--below={placement === 'below'}
			class:sy-popover--above={placement === 'above'}
			class:sy-popover--right={placement === 'right'}
			class:sy-popover--left={placement === 'left'}
			style={popoverStyle}
			ontransitionend={finishDesktopClose}
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
		background: var(--sy-surface--floating);
		border: var(--sy-surface-border);
		border-radius: var(--sy-border-radius--floating);
		box-shadow: var(--sy-shadow--raised);
		z-index: var(--sy-z-index--top-3);
		animation: sy-popover-enter 0.2s cubic-bezier(0.4, 0, 0.2, 1) forwards;
	}
	.sy-popover--anchor-motion {
		animation: none;
		transition:
			transform 290ms cubic-bezier(0.2, 1.3, 0.3, 1),
			opacity 200ms ease-out;
	}
	.sy-popover--anchor-motion.sy-popover--opening,
	.sy-popover--anchor-motion.sy-popover--closing {
		opacity: 0;
		transform: scale(0.12);
	}
	.sy-popover--anchor-motion.sy-popover--closing {
		pointer-events: none;
		transition:
			transform 210ms cubic-bezier(0.55, 0, 1, 0.45),
			opacity 170ms ease-in;
	}
	@media (prefers-reduced-motion: reduce) {
		.sy-popover--anchor-motion {
			transition: none;
		}
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
		border-radius: calc(var(--sy-border-radius--floating) - 1px);
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
		border-bottom-color: var(--sy-surface--floating);
	}

	.sy-popover--above::before {
		bottom: -16px;
		left: var(--sy-popover-arrow-x, 50%);
		transform: translateX(-50%);
		border-top-color: var(--sy-surface--floating);
	}

	.sy-popover--right::before {
		left: -16px;
		top: var(--sy-popover-arrow-y, 50%);
		transform: translateY(-50%);
		border-right-color: var(--sy-surface--floating);
	}

	.sy-popover--left::before {
		right: -16px;
		top: var(--sy-popover-arrow-y, 50%);
		transform: translateY(-50%);
		border-left-color: var(--sy-surface--floating);
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
		color: var(--sy-text--muted);
	}

	.sy-popover__mobile-content {
		min-height: 0;
		overflow-y: auto;
		flex: 1;
	}
</style>
