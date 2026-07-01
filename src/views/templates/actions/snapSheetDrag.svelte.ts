import type { Action } from 'svelte/action';

export type SnapSheetDragOptions = {
	/** Current resolved sheet height in px (the component's sheetHeight). */
	getCurrentHeight: () => number;
	/** Minimum sheet height (collapsed) in px. */
	getMinHeight: () => number;
	/** Maximum sheet height (full) in px. */
	getMaxHeight: () => number;
	/** True when the sheet is already at its tallest snap; gates upward takeover. */
	isAtMaxSnap: () => boolean;
	/** Called when a body drag is claimed, with the sheet height at gesture start. */
	onDragStart: (_startHeight: number) => void;
	/** Called on each drag frame with the new live height. */
	onDragMove: (_height: number) => void;
	/** Called on release with the release height and flick velocity (px/ms, + = upward). */
	onDragEnd: (_releaseHeight: number, _velocityPxPerMs: number) => void;
	/** Disables the gesture entirely when false. */
	enabled?: boolean;
};

// Travel (px) before we decide a touch is a drag and lock its direction.
const DRAG_START_THRESHOLD_PX = 6;
// A scrollTop at or below this counts as "scrolled to the top".
const SCROLL_TOP_EPSILON_PX = 1;

type GestureMode = 'undecided' | 'dragging-sheet' | 'native-scroll';

function isScrollable(element: HTMLElement): boolean {
	const overflowY = getComputedStyle(element).overflowY;
	return (
		(overflowY === 'auto' || overflowY === 'scroll') &&
		element.scrollHeight > element.clientHeight + 1
	);
}

/**
 * Walks up from `start` to `root` and returns the nearest actually-scrollable
 * ancestor, or null when none scrolls. Used to decide whether a downward drag
 * should collapse the sheet (content at top) or scroll the content natively.
 */
function findScrollContainer(start: HTMLElement | null, root: HTMLElement): HTMLElement | null {
	let node: HTMLElement | null = start;
	while (node && node !== root.parentElement) {
		if (isScrollable(node)) {
			return node;
		}
		node = node.parentElement;
	}
	return null;
}

/**
 * Svelte action that lets the entire sheet body be swiped to expand/collapse, while
 * still allowing inner lists to scroll. Touch only — the sheet renders on mobile.
 * The drag handle keeps its own pointer handlers; touches that start on the handle
 * are ignored here so it isn't double-driven.
 *
 * Direction is locked once the touch crosses DRAG_START_THRESHOLD_PX:
 *   - Up   + not at full  → drive the sheet (grow). At full → native scroll.
 *   - Down + content at top → collapse the sheet. Otherwise → native scroll.
 * The lock holds for the rest of the gesture (no mid-gesture handoff, matching iOS).
 */
export const snapSheetDrag: Action<HTMLElement, SnapSheetDragOptions> = (node, options) => {
	let settings = options;

	let activeTouchId: number | null = null;
	let startY = 0;
	let startHeight = 0;
	// lastY / lastMoveTime feed the instantaneous velocity used for flick settling.
	let lastY = 0;
	let lastMoveTime = 0;
	let lastVelocity = 0;
	let gestureMode: GestureMode = 'undecided';
	let scrollContainerAtStart: HTMLElement | null = null;

	function resetGesture(): void {
		activeTouchId = null;
		gestureMode = 'undecided';
		scrollContainerAtStart = null;
	}

	function findActiveTouch(event: TouchEvent): Touch | null {
		if (activeTouchId === null) {
			return null;
		}
		for (const touch of Array.from(event.changedTouches)) {
			if (touch.identifier === activeTouchId) {
				return touch;
			}
		}
		return null;
	}

	function handleTouchStart(event: TouchEvent): void {
		if (settings.enabled === false) {
			return;
		}
		// Multi-touch (e.g. pinch): abandon any drag and let the browser handle it.
		if (event.touches.length > 1) {
			gestureMode = 'native-scroll';
			activeTouchId = null;
			return;
		}
		const touch = event.changedTouches[0];
		const target = touch.target instanceof HTMLElement ? touch.target : null;
		// The handle pill drives the drag through its own pointer handlers.
		if (target?.closest('.sy-snap-sheet__handle')) {
			return;
		}
		activeTouchId = touch.identifier;
		startY = touch.clientY;
		lastY = touch.clientY;
		lastMoveTime = event.timeStamp;
		lastVelocity = 0;
		startHeight = settings.getCurrentHeight();
		scrollContainerAtStart = findScrollContainer(target, node);
		gestureMode = 'undecided';
	}

	function handleTouchMove(event: TouchEvent): void {
		const touch = findActiveTouch(event);
		if (!touch) {
			return;
		}
		const deltaY = touch.clientY - startY; // + = finger moved down (collapse intent)

		const now = event.timeStamp;
		const elapsed = Math.max(1, now - lastMoveTime);
		lastVelocity = (lastY - touch.clientY) / elapsed; // + = upward
		lastY = touch.clientY;
		lastMoveTime = now;

		if (gestureMode === 'undecided') {
			if (Math.abs(deltaY) < DRAG_START_THRESHOLD_PX) {
				return;
			}
			const draggingUp = deltaY < 0;
			if (draggingUp) {
				gestureMode = settings.isAtMaxSnap() ? 'native-scroll' : 'dragging-sheet';
			} else {
				const atTop =
					!scrollContainerAtStart ||
					scrollContainerAtStart.scrollTop <= SCROLL_TOP_EPSILON_PX;
				gestureMode = atTop ? 'dragging-sheet' : 'native-scroll';
			}
			if (gestureMode === 'dragging-sheet') {
				settings.onDragStart(startHeight);
			}
		}

		if (gestureMode !== 'dragging-sheet') {
			return;
		}

		// Take over from native scroll for the rest of the gesture.
		event.preventDefault();
		const nextHeight = Math.min(
			settings.getMaxHeight(),
			Math.max(settings.getMinHeight(), startHeight - deltaY)
		);
		settings.onDragMove(nextHeight);
	}

	function handleTouchEnd(event: TouchEvent): void {
		const touch = findActiveTouch(event);
		if (!touch) {
			return;
		}
		const wasDragging = gestureMode === 'dragging-sheet';
		const velocity = lastVelocity;
		resetGesture();
		if (wasDragging) {
			settings.onDragEnd(settings.getCurrentHeight(), velocity);
		}
	}

	node.addEventListener('touchstart', handleTouchStart, { passive: true });
	node.addEventListener('touchmove', handleTouchMove, { passive: false });
	node.addEventListener('touchend', handleTouchEnd);
	node.addEventListener('touchcancel', handleTouchEnd);

	return {
		update(newOptions: SnapSheetDragOptions) {
			settings = newOptions;
		},
		destroy() {
			node.removeEventListener('touchstart', handleTouchStart);
			node.removeEventListener('touchmove', handleTouchMove);
			node.removeEventListener('touchend', handleTouchEnd);
			node.removeEventListener('touchcancel', handleTouchEnd);
		},
	};
};
