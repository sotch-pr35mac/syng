<script lang="ts">
	import { tick, type Component, type ComponentType, type Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import {
		DROPDOWN_DIRECTIONS,
		DROPDOWN_POSITIONS,
		type DropdownDirection,
		type DropdownPosition,
	} from '@/types/dropdown.js';
	import { isMobile } from '@/utils/device.js';
	import { portal } from '@/actions/portal.svelte.js';
	import { overlayFocus, focusOutsideOverlay } from '@/actions/overlayFocus.js';

	/* Dropdown Values Prop */
	// The values to be present in the dropdown list.
	// Values should be an array of objects in the following form:
	// [
	//   {
	//     text: 'Value to display', // if applicable
	//     icon: SvelteComponent, // if applicable
	//     id: 'unique identifier',
	//     component: SvelteComponent, // One of the supported SyDropdown Item components
	//     color: 'some color',
	//     hover: 'some hover color'
	//   }
	// ]

	/* Position Prop */
	/* Possible Values */
	// 'right' - Right aligned to the dropdown trigger

	type DropdownValue = {
		id?: string | number;
		component: Component<any>;
		text?: string;
		icon?: Component<any> | ComponentType;
		color?: string;
		hover?: string;
		disabled?: boolean;
		selected?: boolean;
		'aria-label'?: string;
	};
	/**
	 * @typedef {Object} Props
	 * @property {DropdownValue[]} [values] - The values to be present in the dropdown list
	 * @property {import('@/types/dropdown.js').DropdownPosition} [position] - Left aligned to the dropdown trigger
	 * @property {import('@/types/dropdown.js').DropdownDirection} [direction] - Direction the dropdown opens
	 * @property {boolean} [fixed] - Use fixed positioning to escape overflow:hidden containers
	 * @property {import('svelte').Snippet<[boolean, HTMLButtonAttributes]>} [children] - Receives the open state and props to spread onto the trigger button
	 * @property {(id: string | number) => void} [onselection] - Selection handler
	 */
	/** @type {Props} */
	const {
		values = [],
		position = DROPDOWN_POSITIONS.LEFT,
		direction = DROPDOWN_DIRECTIONS.DOWN,
		fixed = false,
		children,
		'aria-label': menuLabel,
		onselection = () => {},
	}: {
		values?: DropdownValue[];
		position?: DropdownPosition;
		direction?: DropdownDirection;
		fixed?: boolean;
		'aria-label'?: string;
		children?: Snippet<[boolean, HTMLButtonAttributes]>;
		onselection?: (_id: string | number) => void;
	} = $props();

	const dropdownId = $props.id();
	const mobile = isMobile();
	let containerElement = $state<HTMLElement>();
	let triggerElement = $state<HTMLElement>();
	let listElement = $state<HTMLElement>();
	let fixedStyle = $state('');
	let active = $state(false);
	let restoreFocus = $state(true);
	let searchText = '';
	let lastTypeTime = 0;
	const TYPEAHEAD_RESET_MS = 600;
	const FIXED_DROPDOWN_OFFSET_PX = 4;

	function menuItems(): HTMLButtonElement[] {
		return [
			...(listElement?.querySelectorAll<HTMLButtonElement>(
				'[role="menuitem"]:not(:disabled), [role="menuitemradio"]:not(:disabled)'
			) ?? []),
		];
	}

	function focusItem(item: HTMLButtonElement | undefined): void {
		if (item) {
			for (const menuItem of menuItems()) {
				menuItem.tabIndex = menuItem === item ? 0 : -1;
			}
			item.focus({ preventScroll: true });
			item.scrollIntoView?.({ block: 'nearest' });
		}
	}

	// Close the dropdown if the user clicks outside of it. The menu's overlayFocus
	// action handles outside clicks and listener cleanup, ignoring the trigger itself.
	function closeMenu(restore = true): void {
		restoreFocus = restore;
		active = false;
		searchText = '';
	}

	function updateFixedPosition(): void {
		if (!fixed || !triggerElement || !listElement) {
			return;
		}
		const viewport = window.visualViewport;
		const gutter = 12;
		const viewportLeft = viewport?.offsetLeft ?? 0;
		const viewportTop = viewport?.offsetTop ?? 0;
		const viewportWidth = viewport?.width ?? window.innerWidth;
		const viewportHeight = viewport?.height ?? window.innerHeight;
		const left = viewportLeft + gutter;
		const top = viewportTop + gutter;
		const bottom = viewportTop + viewportHeight - gutter;
		const rect = triggerElement.getBoundingClientRect();
		const naturalHeight = listElement.scrollHeight;
		const below = Math.max(0, bottom - rect.bottom - FIXED_DROPDOWN_OFFSET_PX);
		const above = Math.max(0, rect.top - top - FIXED_DROPDOWN_OFFSET_PX);
		const upwards =
			direction === DROPDOWN_DIRECTIONS.UP
				? above >= naturalHeight || above > below
				: below < naturalHeight && above > below;
		const maxHeight = Math.max(
			0,
			Math.min(viewportHeight - gutter * 2, upwards ? above : below)
		);
		const height = Math.min(naturalHeight, maxHeight);
		const width = Math.min(
			listElement.getBoundingClientRect().width,
			viewportWidth - gutter * 2
		);
		const preferredLeft =
			position === DROPDOWN_POSITIONS.RIGHT ? rect.right - width : rect.left;
		const menuLeft = Math.max(
			left,
			Math.min(preferredLeft, viewportLeft + viewportWidth - gutter - width)
		);
		const menuTop = Math.max(
			top,
			Math.min(
				bottom - height,
				upwards
					? rect.top - FIXED_DROPDOWN_OFFSET_PX - height
					: rect.bottom + FIXED_DROPDOWN_OFFSET_PX
			)
		);
		fixedStyle = `left:${menuLeft}px;top:${menuTop}px;max-width:${viewportWidth - gutter * 2}px;max-height:${maxHeight}px`;
	}

	async function openMenu(trigger: HTMLElement, edge?: 'first' | 'last'): Promise<void> {
		triggerElement = trigger;
		restoreFocus = true;
		active = true;
		await tick();
		if (!active) {
			return;
		}
		updateFixedPosition();
		const items = menuItems();
		const selected = items.find((item) => item.getAttribute('aria-checked') === 'true');
		focusItem(
			edge === 'last'
				? items[items.length - 1]
				: edge === 'first'
					? items[0]
					: (selected ?? items[0])
		);
	}

	function handleTriggerClick(event: MouseEvent): void {
		if (active) {
			closeMenu();
		} else {
			void openMenu(event.currentTarget as HTMLElement);
		}
	}

	function handleTriggerKeydown(event: KeyboardEvent): void {
		if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
			event.preventDefault();
			void openMenu(
				event.currentTarget as HTMLElement,
				event.key === 'ArrowUp' ? 'last' : event.key === 'ArrowDown' ? 'first' : undefined
			);
		}
	}

	const triggerProps = $derived<HTMLButtonAttributes>({
		id: `${dropdownId}-trigger`,
		'aria-haspopup': 'menu',
		'aria-expanded': active,
		'aria-controls': active ? `${dropdownId}-menu` : undefined,
		onclick: handleTriggerClick,
		onkeydown: handleTriggerKeydown,
	});

	function handleSelect(value: DropdownValue): void {
		if (!value.disabled && value.id !== undefined) {
			closeMenu();
			onselection(value.id);
		}
	}

	function handleMenuKeydown(event: KeyboardEvent): void {
		const items = menuItems();
		const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement);
		let nextIndex: number | undefined;
		if (event.key === 'ArrowDown') {
			nextIndex = (currentIndex + 1) % items.length;
		} else if (event.key === 'ArrowUp') {
			nextIndex = (currentIndex - 1 + items.length) % items.length;
		} else if (event.key === 'Home') {
			nextIndex = 0;
		} else if (event.key === 'End') {
			nextIndex = items.length - 1;
		} else if (event.key === 'Tab') {
			closeMenu(false);
			if (
				listElement &&
				triggerElement &&
				focusOutsideOverlay(listElement, triggerElement, event.shiftKey)
			) {
				event.preventDefault();
			}
			return;
		} else if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			items[currentIndex]?.click();
			return;
		} else if (event.key.length === 1 && !event.altKey && !event.ctrlKey && !event.metaKey) {
			const now = Date.now();
			searchText =
				now - lastTypeTime > TYPEAHEAD_RESET_MS ? event.key : searchText + event.key;
			lastTypeTime = now;
			const normalized = searchText.toLocaleLowerCase();
			const repeated = [...normalized].every((character) => character === normalized[0]);
			const prefix = repeated ? normalized[0] : normalized;
			const ordered = [...items.slice(currentIndex + 1), ...items.slice(0, currentIndex + 1)];
			const match = ordered.find((item) =>
				item.textContent?.trim().toLocaleLowerCase().startsWith(prefix)
			);
			if (match) {
				event.preventDefault();
				focusItem(match);
			}
			return;
		}
		if (nextIndex !== undefined) {
			event.preventDefault();
			focusItem(items[nextIndex]);
		}
	}

	// Portaled to <body> so position:fixed resolves against the viewport, not a
	// transformed ancestor (e.g. SySnapSheet's translate3d), which would otherwise displace it.
	function menuPortal(node: HTMLElement) {
		return fixed
			? portal(node, {
					owner: containerElement,
					attributes: { 'data-sy-portal-overlay': 'true' },
				})
			: undefined;
	}

	$effect(() => {
		if (!active || !fixed) {
			return undefined;
		}
		// A transformed ancestor (such as a dragging or snapping SySnapSheet) can
		// move the trigger without a scroll or resize event. Follow its rendered
		// bounds only while the fixed menu is open, including direction changes.
		updateFixedPosition();
		let positionFrame: number;
		const followTrigger = () => {
			updateFixedPosition();
			positionFrame = requestAnimationFrame(followTrigger);
		};
		positionFrame = requestAnimationFrame(followTrigger);
		window.addEventListener('resize', updateFixedPosition);
		window.addEventListener('scroll', updateFixedPosition, true);
		window.visualViewport?.addEventListener('resize', updateFixedPosition);
		window.visualViewport?.addEventListener('scroll', updateFixedPosition);
		return () => {
			cancelAnimationFrame(positionFrame);
			window.removeEventListener('resize', updateFixedPosition);
			window.removeEventListener('scroll', updateFixedPosition, true);
			window.visualViewport?.removeEventListener('resize', updateFixedPosition);
			window.visualViewport?.removeEventListener('scroll', updateFixedPosition);
		};
	});
</script>

<div class="sy-dropdown--container" class:sy-dropdown--active={active} bind:this={containerElement}>
	{@render children?.(active, triggerProps)}
	{#if active}
		<div
			use:menuPortal
			use:overlayFocus={{
				initialFocus: 'none',
				returnFocus: triggerElement,
				restoreFocus,
				closeOnOutside: true,
				ignoreElement: triggerElement,
				onclose: (reason) => closeMenu(reason !== 'outside'),
			}}
			bind:this={listElement}
			id={`${dropdownId}-menu`}
			role="menu"
			aria-label={menuLabel}
			aria-labelledby={menuLabel ? undefined : `${dropdownId}-trigger`}
			tabindex="-1"
			onkeydown={handleMenuKeydown}
			class={`sy-dropdown--list ${fixed ? 'sy-dropdown--fixed-list' : `sy-dropdown--list--${position} sy-dropdown--list--${direction}`}`}
			class:sy-dropdown--list--mobile={mobile}
			style={fixed ? fixedStyle : undefined}
		>
			<div class="sy-dropdown--list--content" role="none">
				{#each values as value (value.id ?? value)}
					<value.component {...value} onclick={() => handleSelect(value)} />
				{/each}
			</div>
		</div>
	{/if}
</div>

<style>
	.sy-dropdown--container {
		display: inline-block;
		position: relative;
	}
	.sy-dropdown--list {
		max-width: calc(100vw - 2rem);
		position: absolute;
		width: max-content;
		background-color: var(--sy-color--white);
		border-radius: var(--sy-border-radius);
		z-index: var(--sy-z-index--top-3);
		box-sizing: border-box;
		box-shadow: var(--sy-shadow--active);
		visibility: hidden;
		opacity: 0;
		transition: all ease;
		transition-duration: var(--sy-transition-duration);
	}
	.sy-dropdown--list--mobile {
		box-shadow: var(--sy-mobile-overlay-shadow);
	}
	.sy-dropdown--list--content {
		display: flex;
		flex-direction: column;
		overflow-y: scroll;
		height: max-content;
		max-height: 85vh;
	}
	.sy-dropdown--list--down {
		top: 100%;
		margin-top: var(--sy-space);
	}
	.sy-dropdown--list--up {
		bottom: 100%;
		margin-bottom: var(--sy-space);
	}
	.sy-dropdown--list--left {
		left: 0;
	}
	.sy-dropdown--list--right {
		right: 0;
	}
	.sy-dropdown--active .sy-dropdown--list {
		visibility: visible;
		opacity: 1;
	}
	.sy-dropdown--fixed-list {
		position: fixed;
		/* An open menu must remain usable above a paused walkthrough. */
		z-index: calc(var(--sy-z-index--top) + 1);
		overflow-y: auto;
		overscroll-behavior: contain;
		visibility: visible;
		opacity: 1;
		/* Geometry follows the trigger directly; animating it adds a trailing delay. */
		transition-property: opacity;
	}
	.sy-dropdown--fixed-list .sy-dropdown--list--content {
		max-height: none;
		overflow-y: visible;
	}
</style>
