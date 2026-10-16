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

	type DropdownValue = {
		id?: string | number;
		component: Component<any>;
		text?: string;
		icon?: Component<any> | ComponentType;
		color?: string;
		hover?: string;
		disabled?: boolean;
	};
	const {
		values = [],
		position = DROPDOWN_POSITIONS.LEFT,
		direction = DROPDOWN_DIRECTIONS.DOWN,
		fixed = false,
		children,
		onselection = () => {},
	}: {
		values?: DropdownValue[];
		position?: DropdownPosition;
		direction?: DropdownDirection;
		fixed?: boolean;
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
				'[role="menuitem"]:not(:disabled)'
			) ?? []),
		];
	}

	function focusItem(item: HTMLButtonElement | undefined): void {
		if (item) {
			for (const menuItem of menuItems()) {
				menuItem.tabIndex = menuItem === item ? 0 : -1;
			}
			item.focus();
		}
	}

	function closeMenu(restore = true): void {
		restoreFocus = restore;
		active = false;
		searchText = '';
	}

	function updateFixedPosition(): void {
		if (!fixed || !triggerElement) {
			return;
		}
		const rect = triggerElement.getBoundingClientRect();
		const styles = ['position:fixed', 'z-index:var(--sy-z-index--top-3)'];
		if (position === DROPDOWN_POSITIONS.RIGHT) {
			styles.push(`right:${window.innerWidth - rect.right}px`);
		} else {
			styles.push(`left:${rect.left}px`);
		}
		if (direction === DROPDOWN_DIRECTIONS.UP) {
			styles.push(`bottom:${window.innerHeight - rect.top + FIXED_DROPDOWN_OFFSET_PX}px`);
		} else {
			styles.push(`top:${rect.bottom + FIXED_DROPDOWN_OFFSET_PX}px`);
		}
		fixedStyle = styles.join(';');
	}

	async function openMenu(trigger: HTMLElement, last = false): Promise<void> {
		triggerElement = trigger;
		restoreFocus = true;
		active = true;
		updateFixedPosition();
		await tick();
		const items = menuItems();
		focusItem(last ? items[items.length - 1] : items[0]);
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
			void openMenu(event.currentTarget as HTMLElement, event.key === 'ArrowUp');
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
		window.addEventListener('resize', updateFixedPosition);
		window.addEventListener('scroll', updateFixedPosition, true);
		return () => {
			window.removeEventListener('resize', updateFixedPosition);
			window.removeEventListener('scroll', updateFixedPosition, true);
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
			aria-labelledby={`${dropdownId}-trigger`}
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
		visibility: visible;
		opacity: 1;
	}
</style>
