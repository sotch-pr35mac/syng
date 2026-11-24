<script lang="ts">
	import type { Snippet } from 'svelte';
	import { onMount, tick, untrack } from 'svelte';
	import {
		SHEET_SNAPS,
		COLLAPSED_HEIGHT,
		PARTIAL_HEIGHT_RATIO,
		FULL_HEIGHT_RATIO,
	} from '@/types/snapSheet.js';
	import type { SheetSnap } from '@/types/snapSheet.js';
	import { snapSheetDrag } from '@/actions/snapSheetDrag.svelte.js';
	import { overlayFocus } from '@/actions/overlayFocus.js';
	import { walkthroughTarget } from '@/actions/walkthroughTarget.svelte.js';
	import type { WalkthroughTargetId } from '@/types/walkthrough.js';

	// Above this release velocity (px/ms) we treat the gesture as a flick and jump
	// one snap in the flick direction rather than settling to the nearest snap.
	const FLICK_VELOCITY_THRESHOLD_PX_PER_MS = 0.5;
	const SHEET_MOTION_DURATION_MS = 360;
	// The sheet's CSS height excludes its 1px top and bottom borders.
	const FULL_TOP_GAP = 10;
	let contentTop = $state(0);

	const getPartialHeight = () => Math.round(window.innerHeight * PARTIAL_HEIGHT_RATIO);
	const getFullHeight = () =>
		Math.min(
			Math.round(window.innerHeight * FULL_HEIGHT_RATIO),
			Math.max(COLLAPSED_HEIGHT, Math.floor(window.innerHeight - contentTop - FULL_TOP_GAP))
		);

	const SNAP_HEIGHTS: Record<SheetSnap, () => number> = {
		collapsed: () => COLLAPSED_HEIGHT,
		partial: getPartialHeight,
		full: getFullHeight,
	};

	const {
		id = undefined,
		children,
		initialSnap = 'collapsed',
		reopenKey = undefined,
		guideTarget = undefined,
		onSnapChange,
		accessibleName = 'Options',
		returnFocus = undefined,
		onclose = undefined,
		onback = undefined,
		dismissible = false,
	}: {
		id?: string;
		children?: Snippet;
		initialSnap?: SheetSnap;
		reopenKey?: number | string;
		guideTarget?: WalkthroughTargetId;
		onSnapChange?: (_snap: SheetSnap) => void;
		accessibleName?: string;
		returnFocus?: HTMLElement;
		onclose?: () => void;
		onback?: () => void;
		dismissible?: boolean;
	} = $props();

	const getInitialSnap = () => initialSnap;
	let snap = $state<SheetSnap>(untrack(() => dismissible) ? 'collapsed' : getInitialSnap());
	let dragHeight = $state<number | null>(null);
	let handleElement = $state<HTMLElement | undefined>(undefined);
	let sheetElement = $state<HTMLElement | undefined>(undefined);
	let presentation = $state<'offscreen' | 'visible'>(
		untrack(() => dismissible) ? 'offscreen' : 'visible'
	);
	let dismissGeneration = 0;
	let dismissal: { generation: number; promise: Promise<void> } | undefined;
	const prefersReducedMotion = () =>
		window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

	const sheetHeight = $derived(
		dragHeight === null ? SNAP_HEIGHTS[snap]() : Math.min(dragHeight, getFullHeight())
	);
	// Transition applies whenever we're not actively dragging.
	const transitioning = $derived(dragHeight === null);

	const collapsedProgress = $derived(
		Math.max(
			0,
			Math.min(
				1,
				(getPartialHeight() - sheetHeight) / (getPartialHeight() - COLLAPSED_HEIGHT)
			)
		)
	);

	let activePointerId: number | null = null;
	let dragStartY = 0;
	let dragStartHeight = 0;

	function applySnap(target: SheetSnap): void {
		snap = target;
		onSnapChange?.(target);
	}

	export function collapse(): void {
		if (dismissible) {
			void dismiss();
		} else {
			applySnap('collapsed');
		}
	}

	export function openPartial(): void {
		dismissGeneration += 1;
		presentation = 'visible';
		applySnap('partial');
	}

	export function openFull(): void {
		dismissGeneration += 1;
		presentation = 'visible';
		applySnap('full');
	}

	function waitForMotion(): Promise<void> {
		if (prefersReducedMotion()) {
			return Promise.resolve();
		}
		return new Promise((resolve) => {
			window.setTimeout(resolve, SHEET_MOTION_DURATION_MS);
		});
	}

	/** Collapse, leave the viewport, then allow the owner to remove the sheet. */
	export function dismiss(): Promise<void> {
		if (!dismissible) {
			return Promise.resolve();
		}
		if (dismissal?.generation === dismissGeneration) {
			return dismissal.promise;
		}
		const generation = ++dismissGeneration;
		const promise = (async () => {
			dragHeight = null;
			applySnap('collapsed');
			await tick();
			await waitForMotion();
			if (generation !== dismissGeneration) {
				return;
			}
			presentation = 'offscreen';
			await tick();
			await waitForMotion();
			if (generation === dismissGeneration) {
				onclose?.();
			}
		})().finally(() => {
			if (dismissal?.generation === generation) {
				dismissal = undefined;
			}
		});
		dismissal = { generation, promise };
		return promise;
	}

	onMount(() => {
		// The phone shell's content begins below the responsive header and iOS safe area.
		// Keep the full snap below that boundary as the header collapses or re-expands.
		const container = sheetElement?.closest<HTMLElement>('.mobile-app__content');
		if (!container) {
			return undefined;
		}
		const update = () => {
			contentTop = Math.max(0, container.getBoundingClientRect().top);
		};
		const observer = new ResizeObserver(update);
		observer.observe(container);
		// Header height is driven by an inline brand style. Observe that mutation
		// before paint so a growing header cannot overtake a transitioning full sheet.
		const header = container.previousElementSibling;
		const heightTarget = header?.querySelector('.mobile-nav__brand') ?? header;
		const mutations = new MutationObserver(update);
		if (heightTarget) {
			mutations.observe(heightTarget, { attributes: true, attributeFilter: ['style'] });
		}
		window.addEventListener('resize', update);
		update();
		return () => {
			observer.disconnect();
			mutations.disconnect();
			window.removeEventListener('resize', update);
		};
	});

	onMount(() => {
		if (!dismissible) {
			return undefined;
		}
		const openingGeneration = dismissGeneration;
		let mounted = true;
		let openingFrame = 0;
		let settlingFrame = 0;
		openingFrame = requestAnimationFrame(() => {
			settlingFrame = requestAnimationFrame(async () => {
				if (!mounted || openingGeneration !== dismissGeneration) {
					return;
				}
				presentation = 'visible';
				await waitForMotion();
				if (
					mounted &&
					openingGeneration === dismissGeneration &&
					presentation === 'visible' &&
					snap === 'collapsed' &&
					initialSnap !== 'collapsed'
				) {
					applySnap(initialSnap);
				}
			});
		});
		return () => {
			mounted = false;
			cancelAnimationFrame(openingFrame);
			cancelAnimationFrame(settlingFrame);
		};
	});

	// When reopenKey changes (e.g. a new word is tapped while the sheet is open),
	// pop the sheet up so the user notices the content changed. Don't shrink an
	// already-expanded (full) sheet, and don't fire on first mount.
	let previousReopenKey: number | string | undefined;
	let reopenKeyInitialized = false;
	$effect(() => {
		const currentReopenKey = reopenKey;
		if (!reopenKeyInitialized) {
			reopenKeyInitialized = true;
			previousReopenKey = currentReopenKey;
			return;
		}
		if (currentReopenKey === previousReopenKey) {
			return;
		}
		previousReopenKey = currentReopenKey;
		if (untrack(() => snap) !== 'full') {
			openPartial();
		}
	});

	/**
	 * Finds the snap position whose target height is closest to the given pixel height.
	 * Uses reduce to compare each snap's distance from the current drag position.
	 */
	function nearestSnap(height: number): SheetSnap {
		return SHEET_SNAPS.reduce((best, current) =>
			Math.abs(SNAP_HEIGHTS[current]() - height) < Math.abs(SNAP_HEIGHTS[best]() - height)
				? current
				: best
		);
	}

	/**
	 * Chooses the snap to settle on after a body drag. A slow release settles to the
	 * nearest snap; a fast flick jumps one snap in the flick direction so flicking up
	 * reaches full and flicking down reaches collapsed even on short travel.
	 */
	function settleSnap(releaseHeight: number, velocityPxPerMs: number): SheetSnap {
		const distanceTarget = nearestSnap(releaseHeight);
		if (Math.abs(velocityPxPerMs) < FLICK_VELOCITY_THRESHOLD_PX_PER_MS) {
			return distanceTarget;
		}
		const currentIndex = SHEET_SNAPS.indexOf(distanceTarget);
		const direction = velocityPxPerMs > 0 ? 1 : -1;
		const nextIndex = Math.min(SHEET_SNAPS.length - 1, Math.max(0, currentIndex + direction));
		return SHEET_SNAPS[nextIndex];
	}

	function handleBodyDragStart(startHeight: number): void {
		dragStartHeight = startHeight;
		dragHeight = startHeight;
	}

	function handleBodyDragMove(height: number): void {
		dragHeight = height;
	}

	function handleBodyDragEnd(releaseHeight: number, velocityPxPerMs: number): void {
		const target = settleSnap(releaseHeight, velocityPxPerMs);
		dragHeight = null;
		if (target === 'collapsed' && dismissible) {
			collapse();
		} else {
			applySnap(target);
		}
	}

	function onPointerDown(event: PointerEvent): void {
		activePointerId = event.pointerId;
		dragStartY = event.clientY;
		dragStartHeight = sheetHeight;
		dragHeight = dragStartHeight;
		handleElement?.setPointerCapture?.(event.pointerId);
	}

	function onPointerMove(event: PointerEvent): void {
		if (activePointerId !== event.pointerId) {
			return;
		}
		event.preventDefault();
		const delta = dragStartY - event.clientY;
		dragHeight = Math.max(COLLAPSED_HEIGHT, Math.min(getFullHeight(), dragStartHeight + delta));
	}

	function onPointerEnd(event: PointerEvent): void {
		if (activePointerId !== event.pointerId) {
			return;
		}
		const target = nearestSnap(dragHeight ?? sheetHeight);
		activePointerId = null;
		dragHeight = null;
		handleElement?.releasePointerCapture?.(event.pointerId);
		if (target === 'collapsed' && dismissible) {
			collapse();
		} else {
			applySnap(target);
		}
	}
	function handleResizeKeydown(event: KeyboardEvent): void {
		const currentIndex = SHEET_SNAPS.indexOf(snap);
		let next: SheetSnap | undefined;
		if (event.key === 'ArrowUp') {
			next = SHEET_SNAPS[Math.min(SHEET_SNAPS.length - 1, currentIndex + 1)];
		} else if (event.key === 'ArrowDown') {
			next = SHEET_SNAPS[Math.max(0, currentIndex - 1)];
		} else if (event.key === 'Home') {
			next = 'collapsed';
		} else if (event.key === 'End') {
			next = 'full';
		}
		if (next) {
			event.preventDefault();
			if (next === 'collapsed' && dismissible) {
				collapse();
			} else {
				applySnap(next);
			}
		}
	}

	function revealFocusedContent(event: FocusEvent): void {
		// iOS can focus this dialog wrapper when a descendant button is tapped.
		// Only descendant content should trigger focus-driven expansion.
		if (
			snap === 'full' ||
			event.target === sheetElement ||
			!(event.target instanceof HTMLElement) ||
			handleElement?.contains(event.target)
		) {
			return;
		}
		const focusedBounds = event.target.getBoundingClientRect();
		if (
			document.documentElement.dataset.inputModality === 'keyboard' ||
			focusedBounds.bottom > window.innerHeight ||
			focusedBounds.top < 0
		) {
			// Screen-reader focus can move below the viewport without a preceding key event.
			openFull();
		}
	}

	function defaultReturnFocus(): HTMLElement | undefined {
		const focused = document.activeElement;
		return focused instanceof HTMLElement && !sheetElement?.contains(focused)
			? focused
			: handleElement;
	}
</script>

<div
	{id}
	bind:this={sheetElement}
	role="dialog"
	onfocusin={revealFocusedContent}
	aria-label={accessibleName}
	tabindex="-1"
	use:overlayFocus={{
		active: snap !== 'collapsed' || dismissible,
		initialFocus: 'keyboard',
		returnFocus: returnFocus ?? defaultReturnFocus,
		onclose: (reason) => (reason === 'escape' && onback ? onback() : collapse()),
	}}
	class="sy-snap-sheet"
	class:sy-snap-sheet--collapsed={snap === 'collapsed' && dragHeight === null}
	class:sy-snap-sheet--offscreen={presentation === 'offscreen'}
	use:walkthroughTarget={guideTarget}
	class:sy-snap-sheet--transitioning={transitioning}
	style="height: {sheetHeight}px; max-height: {getFullHeight()}px; --sy-sheet-collapse: {collapsedProgress};"
	use:snapSheetDrag={{
		getCurrentHeight: () => sheetHeight,
		getMinHeight: () => COLLAPSED_HEIGHT,
		getMaxHeight: getFullHeight,
		isAtMaxSnap: () => snap === 'full' && dragHeight === null,
		onDragStart: handleBodyDragStart,
		onDragMove: handleBodyDragMove,
		onDragEnd: handleBodyDragEnd,
	}}
>
	<!-- A focusable ARIA separator exposes the existing resize operation to keyboards. -->
	<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
	<div
		bind:this={handleElement}
		class="sy-snap-sheet__handle"
		onpointerdown={onPointerDown}
		onpointermove={onPointerMove}
		onpointerup={onPointerEnd}
		onpointercancel={onPointerEnd}
		role="separator"
		tabindex="0"
		aria-orientation="horizontal"
		aria-valuemin="0"
		aria-valuemax={SHEET_SNAPS.length - 1}
		aria-valuenow={SHEET_SNAPS.indexOf(snap)}
		aria-valuetext={snap}
		onkeydown={handleResizeKeydown}
		aria-label="Resize panel"
	>
		<div class="sy-snap-sheet__handle-pill"></div>
	</div>
	{#if children}{@render children()}{/if}
</div>

<style>
	.sy-snap-sheet {
		transform: translate3d(0, 0, 0);
		position: fixed;
		bottom: calc(var(--sy-sheet-collapse) * max(12px, env(safe-area-inset-bottom, 0px)));
		left: calc(var(--sy-sheet-collapse) * 12px);
		right: calc(var(--sy-sheet-collapse) * 12px);
		background: var(--sy-surface--floating);
		border-radius: calc(32px + var(--sy-sheet-collapse) * 4px)
			calc(32px + var(--sy-sheet-collapse) * 4px) calc(var(--sy-sheet-collapse) * 36px)
			calc(var(--sy-sheet-collapse) * 36px);
		border: var(--sy-mobile-surface-border);
		box-shadow: var(--sy-mobile-overlay-shadow);
		display: flex;
		flex-direction: column;
		overflow: hidden;
		z-index: var(--sy-z-index--mobile-sheet);
		will-change: transform, height;
	}
	.sy-snap-sheet--offscreen {
		transform: translate3d(0, calc(100% + 40px + env(safe-area-inset-bottom, 0px)), 0);
	}

	.sy-snap-sheet--transitioning {
		transition:
			transform 0.35s cubic-bezier(0.4, 0, 0.2, 1),
			height 0.35s cubic-bezier(0.4, 0, 0.2, 1),
			bottom 0.35s cubic-bezier(0.4, 0, 0.2, 1),
			left 0.35s cubic-bezier(0.4, 0, 0.2, 1),
			right 0.35s cubic-bezier(0.4, 0, 0.2, 1),
			border-radius 0.35s cubic-bezier(0.4, 0, 0.2, 1);
	}
	@media (prefers-reduced-motion: reduce) {
		.sy-snap-sheet--transitioning {
			transition: none;
		}
	}

	.sy-snap-sheet__handle {
		display: flex;
		justify-content: center;
		align-items: center;
		padding: 10px 0 6px;
		flex-shrink: 0;
		touch-action: none;
		cursor: grab;
		user-select: none;
	}
	.sy-snap-sheet--collapsed .sy-snap-sheet__handle {
		padding-bottom: 0;
	}
	.sy-snap-sheet--collapsed :global(.sy-snap-sheet__expanded-content) {
		visibility: hidden;
	}

	.sy-snap-sheet__handle:active {
		cursor: grabbing;
	}

	.sy-snap-sheet__handle-pill {
		width: 36px;
		height: 4px;
		border-radius: 2px;
		background: var(--sy-control--border);
	}
</style>
