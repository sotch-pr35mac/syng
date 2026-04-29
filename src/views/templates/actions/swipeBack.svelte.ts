import type { Action } from 'svelte/action';

export type SwipeBackOptions = {
	/** Invoked when a completed swipe crosses the distance or velocity threshold. */
	onBack?: () => void;
	/** Width in pixels of the left-edge zone that initiates the gesture. */
	edgeSize?: number;
	/** Disables the gesture entirely when false. */
	enabled?: boolean;
};

type ResolvedOptions = Required<SwipeBackOptions>;

const DEFAULT_EDGE_SIZE_PX = 24;
// Horizontal travel (in px) required before we claim the gesture from the browser.
const DRAG_START_THRESHOLD_PX = 5;
// Fraction of the host width the finger must travel to trigger back on release.
const DISTANCE_THRESHOLD_RATIO = 0.4;
// Rightward velocity (px/ms) that triggers back regardless of distance — a flick.
const VELOCITY_THRESHOLD_PX_PER_MS = 0.5;
// iOS-style easing curve and duration for the snap animations.
const SNAP_EASING = 'cubic-bezier(0.32, 0.72, 0, 1)';
const SNAP_DURATION_MS = 220;
const ACTIVE_BOX_SHADOW = '-8px 0 24px rgba(0, 0, 0, 0.15)';

function resolveOptions(options: SwipeBackOptions | undefined): ResolvedOptions {
	return {
		onBack: options?.onBack ?? (() => window.history.back()),
		edgeSize: options?.edgeSize ?? DEFAULT_EDGE_SIZE_PX,
		enabled: options?.enabled ?? true,
	};
}

/**
 * Svelte action that adds iOS-style edge-swipe-to-go-back to its host element.
 * Applies only to touch/pen input; mouse events are ignored. This action is only
 * attached to pages that are exclusively reachable on mobile platforms, so desktop
 * users are never affected regardless of pointer type.
 */
export const swipeBack: Action<HTMLElement, SwipeBackOptions | undefined> = (node, options) => {
	let settings = resolveOptions(options);

	// Gesture tracking state. activePointerId is null when no swipe is in progress.
	let activePointerId: number | null = null;
	let startX = 0;
	let startY = 0;
	// lastX and lastMoveTime are used to compute instantaneous velocity on each move event.
	let lastX = 0;
	let lastMoveTime = 0;
	let lastVelocity = 0;
	// dragging becomes true once the gesture has been claimed (horizontal intent confirmed).
	let dragging = false;
	// Fires the onBack callback after the snap animation completes.
	let pendingBackTimeout: number | null = null;

	function resetStyles(): void {
		node.style.transition = '';
		node.style.transform = '';
		node.style.boxShadow = '';
		node.style.willChange = '';
	}

	function handlePointerDown(event: PointerEvent): void {
		if (!settings.enabled) {
			return;
		}
		// Only respond to touch/pen; mouse input is left for desktop pointer devices.
		if (event.pointerType !== 'touch' && event.pointerType !== 'pen') {
			return;
		}
		// Only begin a gesture if the touch started within the left-edge zone.
		if (event.clientX > settings.edgeSize) {
			return;
		}

		activePointerId = event.pointerId;
		startX = event.clientX;
		startY = event.clientY;
		lastX = event.clientX;
		lastMoveTime = event.timeStamp;
		lastVelocity = 0;
		dragging = false;
	}

	function handlePointerMove(event: PointerEvent): void {
		if (activePointerId !== event.pointerId) {
			return;
		}

		const deltaX = event.clientX - startX;
		const deltaY = event.clientY - startY;

		if (!dragging) {
			// Wait until there's enough movement to determine intent (horizontal vs vertical scroll).
			if (
				Math.abs(deltaX) < DRAG_START_THRESHOLD_PX &&
				Math.abs(deltaY) < DRAG_START_THRESHOLD_PX
			) {
				return;
			}
			// If the dominant direction is vertical, abandon the gesture so normal scroll works.
			if (Math.abs(deltaX) <= Math.abs(deltaY)) {
				activePointerId = null;
				return;
			}
			// Horizontal intent confirmed — claim the pointer and begin translating the node.
			dragging = true;
			node.setPointerCapture(event.pointerId);
			node.style.transition = 'none';
			node.style.willChange = 'transform';
			node.style.boxShadow = ACTIVE_BOX_SHADOW;
		}

		event.preventDefault();
		const clampedDelta = Math.max(0, deltaX);

		// Track instantaneous velocity to detect flick gestures on release.
		const now = event.timeStamp;
		const elapsed = Math.max(1, now - lastMoveTime);
		lastVelocity = (event.clientX - lastX) / elapsed;
		lastX = event.clientX;
		lastMoveTime = now;

		node.style.transform = `translateX(${clampedDelta}px)`;
	}

	function handlePointerUp(event: PointerEvent): void {
		if (activePointerId !== event.pointerId) {
			return;
		}
		const wasDragging = dragging;
		activePointerId = null;
		dragging = false;

		if (!wasDragging) {
			return;
		}

		const width = node.getBoundingClientRect().width;
		const deltaX = Math.max(0, event.clientX - startX);
		// Trigger back if the finger travelled far enough OR if it was a fast flick.
		const shouldGoBack =
			deltaX > width * DISTANCE_THRESHOLD_RATIO ||
			lastVelocity > VELOCITY_THRESHOLD_PX_PER_MS;

		node.style.transition = `transform ${SNAP_DURATION_MS}ms ${SNAP_EASING}`;

		if (shouldGoBack) {
			// Animate the page off-screen, then invoke the back callback once the animation settles.
			node.style.transform = `translateX(${width}px)`;
			pendingBackTimeout = window.setTimeout(() => {
				pendingBackTimeout = null;
				settings.onBack();
			}, SNAP_DURATION_MS);
		} else {
			// Snap back to the original position.
			node.style.transform = 'translateX(0)';
			node.addEventListener('transitionend', resetStyles, { once: true });
		}
	}

	function handlePointerCancel(event: PointerEvent): void {
		if (activePointerId !== event.pointerId) {
			return;
		}
		const wasDragging = dragging;
		activePointerId = null;
		dragging = false;

		if (!wasDragging) {
			return;
		}

		node.style.transition = `transform ${SNAP_DURATION_MS}ms ${SNAP_EASING}`;
		node.style.transform = 'translateX(0)';
		node.addEventListener('transitionend', resetStyles, { once: true });
	}

	node.addEventListener('pointerdown', handlePointerDown);
	node.addEventListener('pointermove', handlePointerMove);
	node.addEventListener('pointerup', handlePointerUp);
	node.addEventListener('pointercancel', handlePointerCancel);

	return {
		update(newOptions) {
			settings = resolveOptions(newOptions);
		},
		destroy() {
			node.removeEventListener('pointerdown', handlePointerDown);
			node.removeEventListener('pointermove', handlePointerMove);
			node.removeEventListener('pointerup', handlePointerUp);
			node.removeEventListener('pointercancel', handlePointerCancel);
			if (pendingBackTimeout !== null) {
				clearTimeout(pendingBackTimeout);
				pendingBackTimeout = null;
			}
		},
	};
};
