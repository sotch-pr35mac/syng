import { afterEach, expect, it, vi } from 'vitest';
import { overlayFocus } from '@/actions/overlayFocus.js';
import { containsOwnedNode, portal } from '@/actions/portal.svelte.js';

const cleanups: Array<() => void> = [];
afterEach(() => {
	cleanups.reverse().forEach((cleanup) => cleanup());
	cleanups.length = 0;
	document.body.replaceChildren();
	delete document.documentElement.dataset.inputModality;
});

function element(tag = 'div', parent = document.body): HTMLElement {
	const node = document.createElement(tag);
	parent.appendChild(node);
	return node;
}

function keydown(key: string, shiftKey = false): KeyboardEvent {
	const event = new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true });
	document.activeElement?.dispatchEvent(event);
	return event;
}

it('keeps a modal focus trap and restores pre-existing background attributes without native inert', () => {
	const background = element();
	background.setAttribute('aria-hidden', 'false');
	const opener = element('button', background);
	opener.focus();
	const modal = element();
	const first = element('button', modal);
	const last = element('button', modal);
	const action = overlayFocus(modal, { modal: true, initialFocus: 'none' });
	cleanups.push(() => action && action.destroy?.());
	expect(background.getAttribute('aria-hidden')).toBe('true');
	expect(background.hasAttribute('inert')).toBe(true);
	last.focus();
	expect(keydown('Tab').defaultPrevented).toBe(true);
	expect(document.activeElement).toBe(first);
	keydown('Tab', true);
	expect(document.activeElement).toBe(last);
	opener.focus();
	expect(document.activeElement).toBe(first);
	// A blocked backdrop must not cancel restoration when the dialog later closes.
	background.dispatchEvent(new Event('pointerdown', { bubbles: true, cancelable: true }));
	action && action.destroy?.();
	expect(background.getAttribute('aria-hidden')).toBe('false');
	expect(background.hasAttribute('inert')).toBe(false);
	expect(document.activeElement).toBe(opener);
});

it('allows an owned nested portal and dismisses only the top overlay with Escape', () => {
	const opener = element('button');
	opener.focus();
	const modal = element();
	const menuTrigger = element('button', modal);
	const modalClose = vi.fn();
	const modalAction = overlayFocus(modal, {
		modal: true,
		initialFocus: 'none',
		onclose: modalClose,
	});
	cleanups.push(() => modalAction && modalAction.destroy?.());
	menuTrigger.focus();
	const menu = element('div', modal);
	const item = element('button', menu);
	const portalAction = portal(menu, { owner: menuTrigger });
	cleanups.push(() => portalAction && portalAction.destroy?.());
	const menuClose = vi.fn();
	const menuAction = overlayFocus(menu, { initialFocus: 'none', onclose: menuClose });
	cleanups.push(() => menuAction && menuAction.destroy?.());
	expect(containsOwnedNode(modal, item)).toBe(true);
	expect(menu.hasAttribute('inert')).toBe(false);
	item.focus();
	expect(document.activeElement).toBe(item);
	keydown('Escape');
	expect(menuClose).toHaveBeenCalledExactlyOnceWith('escape');
	expect(modalClose).not.toHaveBeenCalled();
	menuAction && menuAction.destroy?.();
	portalAction && portalAction.destroy?.();
	expect(document.activeElement).toBe(menuTrigger);
	keydown('Escape');
	expect(modalClose).toHaveBeenCalledExactlyOnceWith('escape');
});

it('does not dismiss nondismissible modals or their underlying overlays', () => {
	const underneath = element();
	const underlyingClose = vi.fn();
	const lowerAction = overlayFocus(underneath, {
		initialFocus: 'none',
		onclose: underlyingClose,
	});
	cleanups.push(() => lowerAction && lowerAction.destroy?.());
	const modal = element();
	const modalClose = vi.fn();
	const action = overlayFocus(modal, {
		modal: true,
		dismissible: false,
		initialFocus: 'none',
		onclose: modalClose,
	});
	cleanups.push(() => action && action.destroy?.());
	keydown('Escape');
	expect(modalClose).not.toHaveBeenCalled();
	expect(underlyingClose).not.toHaveBeenCalled();
});

it('ignores only owned portals for outside dismissal', () => {
	const popover = element();
	const owned = element('button', popover);
	const ownedPortal = portal(owned, { owner: popover });
	cleanups.push(() => ownedPortal && ownedPortal.destroy?.());
	const unrelated = element('button');
	unrelated.dataset.syPortalOverlay = 'true';
	const onclose = vi.fn();
	const action = overlayFocus(popover, { initialFocus: 'none', closeOnOutside: true, onclose });
	cleanups.push(() => action && action.destroy?.());
	owned.click();
	expect(onclose).not.toHaveBeenCalled();
	unrelated.click();
	expect(onclose).toHaveBeenCalledExactlyOnceWith('outside');
});

it('focuses a nonmodal only for keyboard opening', async () => {
	const opener = element('button');
	opener.focus();
	const popover = element();
	const control = element('button', popover);
	document.documentElement.dataset.inputModality = 'pointer';
	const pointerAction = overlayFocus(popover, { initialFocus: 'keyboard' });
	await new Promise((resolve) => setTimeout(resolve, 0));
	expect(document.activeElement).toBe(opener);
	pointerAction && pointerAction.destroy?.();
	document.documentElement.dataset.inputModality = 'keyboard';
	const keyboardAction = overlayFocus(popover, { initialFocus: 'keyboard' });
	cleanups.push(() => keyboardAction && keyboardAction.destroy?.());
	await new Promise((resolve) => setTimeout(resolve, 0));
	expect(document.activeElement).toBe(control);
});
