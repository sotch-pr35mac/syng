<script>
	import { DROPDOWN_DIRECTIONS, DROPDOWN_POSITIONS } from '../../types/dropdown.js';
	import { isMobile } from '../../utils/device.js';

	/* Dropdown Values Prop */
	// The values to be present in the dropdown list.
	// Values should be an array of objects in the follow form:
	// [
	//   {
	//     text: 'Value to display', // if applicable
	//     icon: SvelteComponent, // if applicable
	//     id: 'unique identifier',
	//     component: SvelteComponent // One of the supported SyDropdown Item components
	//     color: 'some color',
	//     hover: 'some hover color'
	//   }

	/* Position Prop */
	/* Possible Values */
	// 'right' - Right aligned to the dropdown trigger

	/**
	 * @typedef {Object} Props
	 * @property {any} [values] - ]
	 * @property {import('../../types/dropdown.js').DropdownPosition} [position] - Left aligned to the dropdown trigger
	 * @property {import('../../types/dropdown.js').DropdownDirection} [direction] - Direction the dropdown opens
	 * @property {boolean} [fixed] - Use fixed positioning to escape overflow:hidden containers
	 * @property {import('svelte').Snippet<[boolean]>} [children] - Receives the open state as a parameter
	 * @property {(id: any) => void} [onselection] - Selection handler
	 */

	/** @type {Props} */
	const {
		values = [],
		position = DROPDOWN_POSITIONS.LEFT,
		direction = DROPDOWN_DIRECTIONS.DOWN,
		fixed = false,
		children,
		onselection = () => {},
	} = $props();

	const mobile = isMobile();
	let containerElement = $state(undefined);
	let triggerElement = $state(undefined);
	let fixedStyle = $state('');
	const FIXED_DROPDOWN_OFFSET_PX = 4;

	// Whether or not the dropdown is "open".
	let active = $state(false);

	const handleClick = (event) => {
		if (!containerElement || !event.composedPath().includes(containerElement)) {
			active = false;
		}
	};
	const handleSelect = (id) => {
		if (id) {
			onselection(id);
			active = false;
		}
	};
	const updateFixedPosition = () => {
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
	};
	const toggleDropdown = () => {
		active = !active;
		if (active) {
			updateFixedPosition();
		}
	};

	// Close the dropdown if the user clicks outside of it
	// $effect automatically handles cleanup when the component is destroyed
	$effect(() => {
		if (active) {
			document.addEventListener('click', handleClick, { capture: true });
			return () => {
				document.removeEventListener('click', handleClick, { capture: true });
			};
		}
		return undefined;
	});

	const getListClasses = () => {
		const classes = ['sy-dropdown--list'];
		if (mobile) {
			classes.push('sy-dropdown--list--mobile');
		}
		if (!fixed) {
			classes.push(`sy-dropdown--list--${position}`, `sy-dropdown--list--${direction}`);
		}
		return classes.join(' ');
	};
</script>

{#snippet listContent()}
	<div class="sy-dropdown--list--content">
		{#each values as value (value.id)}
			<value.component
				text={value.text}
				icon={value.icon}
				color={value.color}
				hover={value.hover}
				onclick={(e) => handleSelect(value.id, e)}
			/>
		{/each}
	</div>
{/snippet}

<div class="sy-dropdown--container" class:sy-dropdown--active={active} bind:this={containerElement}>
	<span
		class="sy-dropdown--trigger"
		role="button"
		tabindex="0"
		onclick={toggleDropdown}
		onkeyup={toggleDropdown}
		bind:this={triggerElement}
	>
		{@render children?.(active)}
	</span>
	{#if !fixed}
		<div class={getListClasses()}>
			{@render listContent()}
		</div>
	{/if}
</div>

{#if fixed && active}
	<div
		class="sy-dropdown--list sy-dropdown--fixed-list"
		class:sy-dropdown--list--mobile={mobile}
		style={fixedStyle}
	>
		{@render listContent()}
	</div>
{/if}

<style>
	.sy-dropdown--container {
		display: inline-block;
		position: relative;
	}
	.sy-dropdown--list {
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
