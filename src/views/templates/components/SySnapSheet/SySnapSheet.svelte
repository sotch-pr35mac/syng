<script lang="ts">
	import type { Snippet } from 'svelte';
	import { untrack } from 'svelte';
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

	const getPartialHeight = () => Math.round(window.innerHeight * PARTIAL_HEIGHT_RATIO);
	const getFullHeight = () => Math.round(window.innerHeight * FULL_HEIGHT_RATIO);

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
	} = $props();

	const getInitialSnap = () => initialSnap;
	let snap = $state<SheetSnap>(getInitialSnap());
	let dragHeight = $state<number | null>(null);
	let handleElement = $state<HTMLElement | undefined>(undefined);
	let sheetElement = $state<HTMLElement | undefined>(undefined);

	const sheetHeight = $derived(dragHeight ?? SNAP_HEIGHTS[snap]());
	// Transition applies whenever we're not actively dragging.
	const transitioning = $derived(dragHeight === null);

	// Render the sheet at full height and reveal it by translating down. Animating `transform`
	// is compositor-accelerated
	const fullSheetHeight = $derived.by(() => {
		// Recompute alongside snap/drag changes so an orientation change between gestures is
		// picked up; reading window.innerHeight is not itself reactive.
		void snap;
		void dragHeight;
		return getFullHeight();
	});
	const sheetTranslateY = $derived(Math.max(0, fullSheetHeight - sheetHeight));

	let activePointerId: number | null = null;
	let dragStartY = 0;
	let dragStartHeight = 0;

	function applySnap(target: SheetSnap): void {
		snap = target;
		onSnapChange?.(target);
	}

	export function collapse(): void {
		applySnap('collapsed');
	}

	export function openPartial(): void {
		applySnap('partial');
	}

	export function openFull(): void {
		applySnap('full');
	}

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
		applySnap(target);
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
		applySnap(target);
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
			applySnap(next);
		}
	}

	function revealFocusedContent(event: FocusEvent): void {
		// iOS can focus this dialog wrapper when a descendant button is tapped.
		// Its full-height box deliberately extends below the viewport at smaller
		// snaps; only descendant content should trigger focus-driven expansion.
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
		active: snap !== 'collapsed',
		initialFocus: 'keyboard',
		returnFocus: returnFocus ?? defaultReturnFocus,
		onclose: (reason) => (reason === 'escape' && onback ? onback() : (onclose ?? collapse)()),
	}}
	class="sy-snap-sheet"
	use:walkthroughTarget={guideTarget}
	class:sy-snap-sheet--transitioning={transitioning}
	style="height: {fullSheetHeight}px; --sy-snap-sheet-hidden-height: {sheetTranslateY}px;"
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
		transform: translate3d(0, var(--sy-snap-sheet-hidden-height), 0);
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		background: var(--sy-color--white);
		border-radius: var(--sy-mobile-space--extra-large) var(--sy-mobile-space--extra-large) 0 0;
		border-top: var(--sy-mobile-surface-border);
		box-shadow: var(--sy-mobile-overlay-shadow);
		display: flex;
		flex-direction: column;
		overflow: hidden;
		z-index: var(--sy-z-index--mobile-sheet);
		will-change: transform;
	}

	.sy-snap-sheet--transitioning {
		transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
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
