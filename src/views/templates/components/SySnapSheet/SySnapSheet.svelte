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
		children,
		initialSnap = 'collapsed',
		reopenKey = undefined,
		onSnapChange,
	}: {
		children?: Snippet;
		initialSnap?: SheetSnap;
		reopenKey?: number | string;
		onSnapChange?: (_snap: SheetSnap) => void;
	} = $props();

	const getInitialSnap = () => initialSnap;
	let snap = $state<SheetSnap>(getInitialSnap());
	let dragHeight = $state<number | null>(null);
	let handleElement = $state<HTMLElement | undefined>(undefined);

	const sheetHeight = $derived(dragHeight ?? SNAP_HEIGHTS[snap]());
	// Transition applies whenever we're not actively dragging.
	const transitioning = $derived(dragHeight === null);

	// Render the sheet at full height and reveal it by translating down. Animating `transform`
	// is compositor-accelerated, so dragging no longer forces a layout/reflow every frame the
	// way animating `height` did — that was the source of the choppiness.
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
</script>

<div
	class="sy-snap-sheet"
	class:sy-snap-sheet--transitioning={transitioning}
	style="height: {fullSheetHeight}px; transform: translate3d(0, {sheetTranslateY}px, 0)"
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
	<div
		bind:this={handleElement}
		class="sy-snap-sheet__handle"
		onpointerdown={onPointerDown}
		onpointermove={onPointerMove}
		onpointerup={onPointerEnd}
		onpointercancel={onPointerEnd}
		role="separator"
		aria-label="Drag to resize"
	>
		<div class="sy-snap-sheet__handle-pill"></div>
	</div>
	{#if children}{@render children()}{/if}
</div>

<style>
	.sy-snap-sheet {
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
		background: var(--sy-color--grey-1);
	}
</style>
