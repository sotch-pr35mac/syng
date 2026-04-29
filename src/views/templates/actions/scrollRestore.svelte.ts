import type { Action } from 'svelte/action';

/**
 * Per-key cache of the last scrollTop seen when a host element was destroyed. Lives for
 * the lifetime of the app session — same model as the route state stores. Scroll positions
 * are written only on destroy and read only on mount, so there is no runtime cost during
 * scrolling itself.
 *
 * A plain Map is used intentionally: reads happen during action setup (inside an effect)
 * and writes happen during action destroy, so no reactive subscription to mutations is
 * required. SvelteMap would add a reactive graph edge for no benefit.
 */
// eslint-disable-next-line svelte/prefer-svelte-reactivity
const scrollPositionsByKey = new Map<string, number>();

/**
 * Svelte action that saves and restores the vertical scroll position of its host element
 * across component mount/unmount cycles.
 *
 * A Svelte action is a function attached to a DOM element via the `use:` directive. Svelte
 * calls it with the element on mount and calls the returned `destroy` on unmount. The
 * optional `update` is called whenever the directive's parameter changes. Actions are the
 * right tool for imperative DOM behaviour tied to an element's lifetime.
 *
 * Usage:
 *   <div use:scrollRestore={'mobile-search-content'}>
 *
 * The key should be a stable, unique string identifying the scrollable container. Two
 * containers sharing a key will trample each other's saved positions. Any string is valid —
 * there is no fixed set of keys. The key can also be reactive (e.g. the active list name)
 * to save and restore independent scroll positions per value.
 */
export const scrollRestore: Action<HTMLElement, string> = (node, key) => {
	let currentKey = key;

	function restore(): void {
		const saved = scrollPositionsByKey.get(currentKey);
		if (saved !== undefined) {
			node.scrollTop = saved;
		}
	}

	// Restore after the initial paint so any layout-dependent content (images, async lists)
	// has a chance to settle. requestAnimationFrame is enough for the common case; callers
	// that populate content asynchronously can call node.scrollTop = stored value themselves
	// if they need precise control.
	requestAnimationFrame(restore);

	return {
		update(nextKey) {
			currentKey = nextKey;
		},
		destroy() {
			scrollPositionsByKey.set(currentKey, node.scrollTop);
		},
	};
};

/**
 * Escape hatch for tests and for any flow that needs to explicitly reset stored scroll
 * positions (e.g. a future "reset app state" action). Not intended for routine use.
 */
export function clearScrollPositions(): void {
	scrollPositionsByKey.clear();
}
