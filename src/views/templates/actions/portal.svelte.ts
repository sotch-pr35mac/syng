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
type PortalOptions =
	| HTMLElement
	| {
			target?: HTMLElement;
			attributes?: Record<string, string>;
	  }
	| undefined;

function resolvePortalOptions(options: PortalOptions): {
	target?: HTMLElement;
	attributes: Record<string, string>;
} {
	if (!options) {
		return {
			target: undefined,
			attributes: {},
		};
	}
	if (options instanceof HTMLElement) {
		return {
			target: options,
			attributes: {},
		};
	}
	return {
		target: options.target,
		attributes: options.attributes ?? {},
	};
}

export const portal: Action<HTMLElement, PortalOptions> = (node, options) => {
	const { target, attributes } = resolvePortalOptions(options);
	const destination = target ?? document.body;
	const previousAttributes = Object.fromEntries(
		Object.keys(attributes).map((name) => [name, node.getAttribute(name)])
	);

	for (const [name, value] of Object.entries(attributes)) {
		node.setAttribute(name, value);
	}
	destination.appendChild(node);

	return {
		destroy() {
			for (const [name, previousValue] of Object.entries(previousAttributes)) {
				if (previousValue === null) {
					node.removeAttribute(name);
				} else {
					node.setAttribute(name, previousValue);
				}
			}
			node.remove();
		},
	};
};
