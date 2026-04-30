<script lang="ts">
	import type { Snippet } from 'svelte';
	import {
		SHEET_SNAPS,
		COLLAPSED_HEIGHT,
		PARTIAL_HEIGHT_RATIO,
		FULL_HEIGHT_RATIO,
	} from '@/types/snapSheet.js';
	import type { SheetSnap } from '@/types/snapSheet.js';

	const getPartialHeight = () => Math.round(window.innerHeight * PARTIAL_HEIGHT_RATIO);
	const getFullHeight = () => Math.round(window.innerHeight * FULL_HEIGHT_RATIO);

	const SNAP_HEIGHTS: Record<SheetSnap, () => number> = {
		collapsed: () => COLLAPSED_HEIGHT,
		partial: getPartialHeight,
		full: getFullHeight,
	};

	const {
		children,
		onSnapChange,
	}: { children?: Snippet; onSnapChange?: (_snap: SheetSnap) => void } = $props();

	let snap = $state<SheetSnap>('collapsed');
	let dragHeight = $state<number | null>(null);
	let handleElement = $state<HTMLElement | undefined>(undefined);

	const sheetHeight = $derived(dragHeight ?? SNAP_HEIGHTS[snap]());
	// Transition applies whenever we're not actively dragging.
	const transitioning = $derived(dragHeight === null);

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
	style="height: {sheetHeight}px"
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
	}

	.sy-snap-sheet--transitioning {
		transition: height 0.35s cubic-bezier(0.4, 0, 0.2, 1);
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
