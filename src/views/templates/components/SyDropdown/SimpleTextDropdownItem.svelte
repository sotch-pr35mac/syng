<script lang="ts">
	import { Check } from 'lucide-svelte';
	import { isMobile } from '@/utils/device.js';
	/* Text Prop */

	/* Color Prop */
	// Color of the text
	// Possible Values:

	/* Hover Prop */
	// Color of the text on hover
	// Possible Values:

	/**
	 * @typedef {Object} Props
	 * @property {string} [text] - The value to be displayed
	 * @property {string} [color] - 'black'
	 * @property {string} [hover] - 'blue'
	 * @property {any} [icon] - Accept the shared dropdown item prop; this item displays text only
	 * @property {boolean} [disabled] - Whether the item can be selected
	 * @property {(event: MouseEvent) => void} [onclick] - Click handler
	 */
	/** @type {Props} */
	const {
		text = '',
		color = 'black',
		hover = 'blue',
		icon: _icon = undefined,
		disabled = false,
		selected = undefined,
		'aria-label': ariaLabel = undefined,
		onclick = () => {},
	}: {
		text?: string;
		color?: string;
		hover?: string;
		icon?: import('svelte').Component<any> | import('svelte').ComponentType;
		disabled?: boolean;
		selected?: boolean;
		'aria-label'?: string;
		onclick?: (_event: MouseEvent) => void;
	} = $props();
	const mobile = isMobile();

	const getClasses = () => {
		return [
			'st-dropdown-item--container',
			`st-dropdown-item--color--${color}`,
			`st-dropdown-item--hover--${hover}`,
		].join(' ');
	};

	const handleClick = (event: MouseEvent) => {
		onclick(event);
	};
</script>

<button
	type="button"
	class={getClasses()}
	class:st-dropdown-item--mobile={mobile}
	role={selected === undefined ? 'menuitem' : 'menuitemradio'}
	tabindex="-1"
	{disabled}
	aria-label={ariaLabel}
	aria-checked={selected}
	onclick={handleClick}
>
	{#if selected !== undefined}<span class="st-dropdown-item--check" aria-hidden="true"
			>{#if selected}<Check size="14" />{/if}</span
		>{/if}
	<span>{text}</span>
</button>

<style>
	.st-dropdown-item--container {
		display: flex;
		align-items: center;
		gap: var(--sy-space--large);
		border: 0;
		background: transparent;
		font: inherit;
		text-align: left;
		min-width: 0;
		white-space: normal;
		overflow-wrap: anywhere;
		cursor: pointer;
		padding: var(--sy-space--large);
		transition: all ease-in-out;
		transition-duration: var(--sy-transition-duration) / 2;
	}
	.st-dropdown-item--mobile {
		min-height: var(--sy-mobile-touch-target);
	}
	.st-dropdown-item--check {
		display: flex;
		flex: 0 0 14px;
	}
	.st-dropdown-item--container:focus-visible {
		outline: 2px solid var(--sy-color--blue-2);
		outline-offset: -2px;
	}
	.st-dropdown-item--container:first-child,
	.st-dropdown-item--container:last-child {
		border-radius: var(--sy-border-radius);
	}
	.st-dropdown-item--container:hover {
		background-color: var(--sy-color--grey-2);
	}
	.st-dropdown-item--color--black {
		color: var(--sy-color--black);
	}
	.st-dropdown-item--hover--blue:hover {
		color: var(--sy-text--blue);
	}
</style>
