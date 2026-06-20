import type { Action } from 'svelte/action';

/**
 * Svelte action that relocates its host element to a target container (default `<body>`)
 * on mount and removes it on destroy.
 *
 * Use this to escape a clipping or transformed ancestor. A CSS `transform` on an ancestor
 * establishes the containing block for `position: fixed` descendants, so a fixed-positioned
 * popup nested inside a transformed element (e.g. a translated bottom sheet) is positioned
 * relative to that element instead of the viewport. Portaling the node to `<body>` restores
 * true viewport-relative fixed positioning.
 *
 * The node keeps its Svelte reactivity and event bindings after the move — only its DOM
 * parent changes. Outside-click logic that relies on `event.composedPath()` still sees the
 * portaled node, because composedPath reflects the actual DOM ancestry, not the Svelte tree.
 *
 * Usage:
 *   <div use:portal>…</div>                 // → document.body
 *   <div use:portal={someContainer}>…</div>
 */
export const portal: Action<HTMLElement, HTMLElement | undefined> = (node, target) => {
	const destination = target ?? document.body;
	destination.appendChild(node);

	return {
		destroy() {
			node.remove();
		},
	};
};
