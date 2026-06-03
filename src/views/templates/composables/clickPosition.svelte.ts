/**
 * Tracks the bounding rect of the most recently clicked element so popovers
 * (e.g. dictionary lookups) can anchor to the click position. Shared by the
 * search and bookmark routes on both desktop and mobile.
 */
export function createClickPositionTracker() {
	let lastClickRect = $state(new DOMRect());

	function captureClickPosition(event: MouseEvent): void {
		if (event.target instanceof HTMLElement) {
			lastClickRect = event.target.getBoundingClientRect();
		}
	}

	return {
		get lastClickRect(): DOMRect {
			return lastClickRect;
		},
		captureClickPosition,
	};
}
