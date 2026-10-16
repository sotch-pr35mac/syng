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
			owner?: HTMLElement;
			attributes?: Record<string, string>;
	  }
	| undefined;

function resolvePortalOptions(options: PortalOptions): {
	target?: HTMLElement;
	owner?: HTMLElement;
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
		owner: options.owner,
		attributes: options.attributes ?? {},
	};
}

// DOM ownership survives moving a popup out of its logical parent's DOM subtree.
// eslint-disable-next-line svelte/prefer-svelte-reactivity
const portalOwners = new Map<HTMLElement, HTMLElement>();

export function containsOwnedNode(container: HTMLElement, target: Node | null): boolean {
	let currentTarget = target;
	const visited: Node[] = [];
	while (currentTarget && !visited.includes(currentTarget)) {
		if (container.contains(currentTarget)) {
			return true;
		}
		visited.push(currentTarget);
		const owner = [...portalOwners].find(([portalNode]) =>
			portalNode.contains(currentTarget)
		)?.[1];
		currentTarget = owner ?? null;
	}
	return false;
}

export function ownedPortalRoots(container: HTMLElement): HTMLElement[] {
	return [...portalOwners.keys()].filter((portalNode) =>
		containsOwnedNode(container, portalNode)
	);
}

export const portal: Action<HTMLElement, PortalOptions> = (node, options) => {
	const { target, owner, attributes } = resolvePortalOptions(options);
	const destination = target ?? document.body;
	const logicalOwner = owner ?? node.parentElement;
	if (logicalOwner && logicalOwner !== destination) {
		portalOwners.set(node, logicalOwner);
	}
	const previousAttributes = Object.fromEntries(
		Object.keys(attributes).map((name) => [name, node.getAttribute(name)])
	);

	for (const [name, value] of Object.entries(attributes)) {
		node.setAttribute(name, value);
	}
	destination.appendChild(node);

	return {
		destroy() {
			portalOwners.delete(node);
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
