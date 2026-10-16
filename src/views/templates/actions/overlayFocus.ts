import type { Action } from 'svelte/action';
import { containsOwnedNode, ownedPortalRoots } from '@/actions/portal.svelte.js';

export type OverlayCloseReason = 'escape' | 'outside';
type OverlayOptions = {
	active?: boolean;
	modal?: boolean;
	dismissible?: boolean;
	initialFocus?: 'always' | 'keyboard' | 'none';
	initialFocusTarget?: HTMLElement | (() => HTMLElement | null | undefined);
	returnFocus?: HTMLElement | (() => HTMLElement | null | undefined);
	restoreFocus?: boolean;
	ignoreElement?: HTMLElement;
	closeOnOutside?: boolean;
	onclose?: (_reason: OverlayCloseReason) => void;
};
type OverlayEntry = {
	node: HTMLElement;
	options: OverlayOptions;
	opener: HTMLElement | null;
	outsidePointer: boolean;
};
const overlays: OverlayEntry[] = [];
const backgroundState = new Map<HTMLElement, { inert: string | null; hidden: string | null }>();
const FOCUSABLE_SELECTOR =
	'a[href], area[href], button, input:not([type="hidden"]), select, textarea, iframe, [contenteditable="true"], [tabindex]';
let backgroundObserver: MutationObserver | undefined;

function isAvailable(element: HTMLElement): boolean {
	if (
		element.matches(':disabled') ||
		element.closest('[hidden], [inert], [aria-hidden="true"]')
	) {
		return false;
	}
	let ancestor: HTMLElement | null = element;
	while (ancestor) {
		const style = getComputedStyle(ancestor);
		if (style.display === 'none' || style.visibility === 'hidden') {
			return false;
		}
		ancestor = ancestor.parentElement;
	}
	return true;
}

export function overlayFocusableElements(container: HTMLElement): HTMLElement[] {
	const roots = [container, ...ownedPortalRoots(container)];
	const elements = roots.flatMap((root) => [
		...root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
	]);
	return [...new Set(elements)].filter(
		(element) => element.tabIndex >= 0 && isAvailable(element)
	);
}

/** Move Tab relative to a menu's trigger, even when its menu is portaled to body. */
export function focusOutsideOverlay(
	container: HTMLElement,
	trigger: HTMLElement,
	backwards: boolean
): boolean {
	const elements = overlayFocusableElements(document.body).filter(
		(element) => !containsOwnedNode(container, element)
	);
	const triggerIndex = elements.indexOf(trigger);
	const next = elements[triggerIndex + (backwards ? -1 : 1)];
	if (triggerIndex >= 0 && next) {
		next.focus();
		return true;
	}
	const modal = topModal();
	if (modal && containsOwnedNode(modal.node, trigger) && elements.length) {
		(backwards ? elements[elements.length - 1] : elements[0]).focus();
		return true;
	}
	trigger.focus();
	return false;
}

function initialTarget(entry: OverlayEntry): HTMLElement {
	const requestedTarget =
		typeof entry.options.initialFocusTarget === 'function'
			? entry.options.initialFocusTarget()
			: entry.options.initialFocusTarget;
	return (
		(requestedTarget?.isConnected ? requestedTarget : undefined) ??
		entry.node.querySelector<HTMLElement>('[data-sy-overlay-heading]') ??
		overlayFocusableElements(entry.node)[0] ??
		entry.node
	);
}

function restoreBackground(): void {
	for (const [element, previous] of backgroundState) {
		for (const [attribute, value] of [
			['inert', previous.inert],
			['aria-hidden', previous.hidden],
		] as const) {
			if (value === null) {
				element.removeAttribute(attribute);
			} else {
				element.setAttribute(attribute, value);
			}
		}
	}
	backgroundState.clear();
}

function topModal(): OverlayEntry | undefined {
	return [...overlays].reverse().find((entry) => entry.options.modal);
}

function updateBackground(): void {
	restoreBackground();
	const modal = topModal();
	if (!modal) {
		return;
	}
	const allowedRoots = [modal.node, ...ownedPortalRoots(modal.node)];
	function visit(parent: HTMLElement): void {
		for (const child of parent.children) {
			if (!(child instanceof HTMLElement) || containsOwnedNode(modal.node, child)) {
				continue;
			}
			if (allowedRoots.some((root) => child.contains(root))) {
				visit(child);
				continue;
			}
			backgroundState.set(child, {
				inert: child.getAttribute('inert'),
				hidden: child.getAttribute('aria-hidden'),
			});
			child.setAttribute('inert', '');
			child.setAttribute('aria-hidden', 'true');
		}
	}
	visit(document.body);
}

function handleKeydown(event: KeyboardEvent): void {
	const top = overlays[overlays.length - 1];
	if (!top || event.defaultPrevented) {
		return;
	}
	if (event.key === 'Escape') {
		// A nondismissible recovery dialog also consumes Escape, protecting overlays below it.
		event.preventDefault();
		event.stopImmediatePropagation();
		if (top.options.dismissible !== false) {
			top.options.onclose?.('escape');
		}
		return;
	}
	const modal = topModal();
	if (event.key !== 'Tab' || !modal) {
		return;
	}
	if (
		top.node.getAttribute('role') === 'menu' &&
		containsOwnedNode(top.node, document.activeElement)
	) {
		// Menus move Tab relative to their trigger rather than their portal's DOM position.
		return;
	}
	const focusable = overlayFocusableElements(modal.node);
	const focused = document.activeElement;
	const first = focusable[0];
	const last = focusable[focusable.length - 1];
	if (!first) {
		event.preventDefault();
		initialTarget(modal).focus({ preventScroll: true });
	} else if (
		event.shiftKey &&
		(focused === first || !focusable.includes(focused as HTMLElement))
	) {
		event.preventDefault();
		last?.focus();
	} else if (!event.shiftKey && (focused === last || !containsOwnedNode(modal.node, focused))) {
		event.preventDefault();
		first.focus();
	}
}

function handleFocus(event: FocusEvent): void {
	const modal = topModal();
	if (modal && !containsOwnedNode(modal.node, event.target as Node)) {
		initialTarget(modal).focus({ preventScroll: true });
	}
}

function handlePointer(event: Event): void {
	const target = event.target as Node;
	for (const entry of overlays) {
		entry.outsidePointer = !containsOwnedNode(entry.node, target);
	}
	const modal = topModal();
	if (modal && !containsOwnedNode(modal.node, target)) {
		// aria-hidden plus the focus guard above provides the iOS 15 inert fallback.
		event.preventDefault();
		event.stopImmediatePropagation();
	}
}

function handleClick(event: MouseEvent): void {
	const target = event.target as Node;
	for (const entry of [...overlays].reverse()) {
		if (
			containsOwnedNode(entry.node, target) ||
			entry.options.ignoreElement?.contains(target)
		) {
			break;
		}
		if (entry.options.closeOnOutside) {
			entry.outsidePointer = true;
			entry.options.onclose?.('outside');
		}
	}
	const modal = topModal();
	if (modal && !containsOwnedNode(modal.node, target)) {
		event.preventDefault();
		event.stopImmediatePropagation();
	}
}

function connect(): void {
	document.addEventListener('keydown', handleKeydown, true);
	document.addEventListener('focusin', handleFocus, true);
	document.addEventListener('pointerdown', handlePointer, true);
	document.addEventListener('click', handleClick, true);
	backgroundObserver = new MutationObserver(updateBackground);
	backgroundObserver.observe(document.body, { childList: true, subtree: true });
}

function disconnect(): void {
	document.removeEventListener('keydown', handleKeydown, true);
	document.removeEventListener('focusin', handleFocus, true);
	document.removeEventListener('pointerdown', handlePointer, true);
	document.removeEventListener('click', handleClick, true);
	backgroundObserver?.disconnect();
	backgroundObserver = undefined;
}

/** Shared focus lifecycle for menus, dialogs, popovers and sheets, including owned portals. */
export const overlayFocus: Action<HTMLElement, OverlayOptions> = (node, initialOptions = {}) => {
	let options = initialOptions;
	let entry: OverlayEntry | undefined;
	let openingTimer: ReturnType<typeof setTimeout> | undefined;
	function activate(): void {
		if (entry || options.active === false) {
			return;
		}
		const returnTarget =
			typeof options.returnFocus === 'function' ? options.returnFocus() : options.returnFocus;
		entry = {
			node,
			options,
			opener:
				returnTarget ??
				(document.activeElement instanceof HTMLElement ? document.activeElement : null),
			outsidePointer: false,
		};
		if (!overlays.length) {
			connect();
		}
		overlays.push(entry);
		updateBackground();
		const shouldFocus =
			options.initialFocus === 'always' ||
			(options.initialFocus !== 'none' &&
				document.documentElement.dataset.inputModality === 'keyboard');
		if (shouldFocus) {
			openingTimer = setTimeout(() => {
				if (
					entry &&
					overlays[overlays.length - 1] === entry &&
					(options.initialFocus === 'always' ||
						!containsOwnedNode(node, document.activeElement))
				) {
					initialTarget(entry).focus({ preventScroll: true });
				}
			}, 0);
		}
	}
	function deactivate(): void {
		clearTimeout(openingTimer);
		if (!entry) {
			return;
		}
		const previousEntry = entry;
		const focused = document.activeElement;
		const restore =
			options.restoreFocus !== false &&
			(entry.options.modal || !entry.outsidePointer) &&
			(containsOwnedNode(node, focused) || focused === document.body);
		overlays.splice(overlays.indexOf(entry), 1);
		entry = undefined;
		updateBackground();
		if (!overlays.length) {
			disconnect();
		}
		if (restore && previousEntry.opener?.isConnected && isAvailable(previousEntry.opener)) {
			previousEntry.opener.focus({ preventScroll: true });
		}
	}
	activate();
	return {
		update(nextOptions = {}) {
			options = nextOptions;
			if (entry) {
				entry.options = options;
			}
			if (options.active === false) {
				deactivate();
			} else {
				activate();
				updateBackground();
			}
		},
		destroy: deactivate,
	};
};
