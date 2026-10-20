<script lang="ts">
	/* Style Prop */
	/* Possible Values */
	// 'ghost' - No background or shadow

	/* Size Prop */
	/* Possible Values */
	// 'small' - Small button
	// 'medium' - Medium button

	/* Shape Prop */
	/* Possible Values */
	// 'rectangle' - Rectangular

	/* Disabled Prop */
	/* Possible Values */
	// true

	/* Group Prop */
	/* Possible Values */
	// true

	/* Color Prop */
	/* Possible Values */
	// 'green'
	// 'blue'
	// 'red'

	/* Hover Prop */
	/* Possible Values */
	// 'green'
	// 'blue'
	// 'red'

	/* Center Prop */
	/* Possible Values */
	// true

	/* Classes Prop */

	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import { isMobile } from '@/utils/device.js';

	/**
	 * @typedef {Object} Props
	 * @property {string} [style] - 'filled' - With background and shadow
	 * @property {string} [size] - 'large' - Large button; defaults to 'medium'
	 * @property {string} [shape] - 'circle' - Circular; defaults to 'rectangle'
	 * @property {boolean} [disabled] - false
	 * @property {boolean | 'true' | 'false'} [grouped] - false
	 * @property {string} [color] - 'yellow', 'green', 'blue', or 'red'
	 * @property {string} [hover] - 'yellow', 'green', 'blue', or 'red'
	 * @property {boolean} [center] - false
	 * @property {boolean} [disableHoverActions] - false
	 * @property {string[]} [classes] - A list of classes
	 * @property {string} [type] - Native button type
	 * @property {string} [form] - Associated native form ID
	 * @property {string} [aria-label] - Accessible label
	 * @property {boolean | 'true' | 'false'} [aria-pressed] - Pressed state
	 * @property {string} [title] - Native title
	 * @property {import('svelte').Snippet} [children]
	 * @property {(event: MouseEvent) => void} [onclick] - Click handler
	 */
	interface Props extends Omit<HTMLButtonAttributes, 'style' | 'children'> {
		style?: string;
		size?: string;
		shape?: string;
		grouped?: boolean | 'true' | 'false';
		color?: string;
		hover?: string;
		center?: boolean;
		disableHoverActions?: boolean;
		classes?: string[];
		children?: Snippet;
	}

	// Optimized for mobile: 44px minimum touch target, larger small-size font.
	const mobile = isMobile();

	/** @type {Props} */
	const {
		style = 'filled',
		size = 'medium',
		shape = 'rectangle',
		disabled = false,
		grouped = false,
		color = undefined,
		hover = undefined,
		center = false,
		disableHoverActions = false,
		classes = [],
		class: className,
		type = 'button',
		children,
		onclick = () => {},
		...restProps
	}: Props = $props();
	const getClasses = () => {
		return classes
			.concat([
				'sy-button',
				`sy-button--${style}`,
				`sy-button--${size}`,
				`sy-button--${shape}`,
				center ? 'sy-button--center' : '',
				color ? `sy-button--color-${color}` : '',
				style === 'filled' && color ? 'sy-button--filled-color' : '',
				hover ? `sy-button--hover-${hover}` : '',
				grouped ? 'sy-button--grouped' : '',
				disableHoverActions ? 'sy-button--hover-actions-disabled' : '',
				mobile ? 'sy-button--mobile' : '',
			])
			.join(' ');
	};
</script>

<button
	{...restProps}
	class={[getClasses(), className]}
	{type}
	{onclick}
	{disabled}
	data-testid="sy-button"
>
	{@render children?.()}
</button>

<style>
	.sy-button {
		margin: 0 var(--sy-space);
		padding: var(--sy-space);
		border: none;
		cursor: pointer;
		color: var(--sy-color--black);
		font-family: var(--sy-font-family);
		max-width: 100%;
		overflow-wrap: anywhere;
	}
	.sy-button:disabled {
		color: var(--sy-color--grey-5);
		cursor: not-allowed;
	}
	.sy-button--filled {
		box-shadow: var(--sy-shadow);
		background-color: var(--sy-color--white);
	}
	@media (hover: hover) {
		.sy-button--filled:not(.sy-button--hover-actions-disabled):hover {
			box-shadow: var(--sy-shadow--active);
			background-color: var(--sy-color--grey-2);
			transition-property: background-color, box-shadow;
			transition-duration: var(--sy-transition-duration);
		}
	}
	.sy-button--filled:active {
		box-shadow: var(--sy-shadow--active);
		background-color: var(--sy-color--grey-2);
	}
	.sy-button--filled:disabled {
		color: var(--sy-color--grey-5);
	}
	.sy-button--ghost {
		background: none;
	}
	.sy-button--ghost:active {
		color: var(--sy-text--blue);
	}
	@media (hover: hover) {
		.sy-button--ghost:not(.sy-button--hover-actions-disabled):hover {
			color: var(--sy-text--blue);
			transition-property: color;
			transition-duration: var(--sy-transition-duration);
		}
		.sy-button--ghost:hover:disabled {
			color: var(--sy-color--grey-5);
		}
	}
	.sy-button--small {
		font-size: 0.625rem;
	}
	.sy-button--medium {
		font-size: 0.8125rem;
	}
	.sy-button--large {
		font-size: 1rem;
		padding: var(--sy-space--large);
	}
	.sy-button--rectangle {
		border-radius: var(--sy-border-radius);
	}
	.sy-button--circle {
		border-radius: 50%;
	}
	.sy-button--grouped {
		border-radius: 0px;
		margin: 1px;
	}
	.sy-button--color-green {
		color: var(--sy-text--green);
		--sy-button-filled-background: var(--sy-fill--green);
		--sy-button-interactive-text: var(--sy-text--green);
	}
	.sy-button--color-blue {
		color: var(--sy-text--blue);
		--sy-button-filled-background: var(--sy-fill--blue);
		--sy-button-interactive-text: var(--sy-text--blue);
	}
	.sy-button--color-red {
		color: var(--sy-text--red);
		--sy-button-filled-background: var(--sy-fill--red);
		--sy-button-interactive-text: var(--sy-text--red);
	}
	.sy-button--color-yellow {
		color: var(--sy-text--yellow);
		--sy-button-filled-background: var(--sy-fill--yellow);
		--sy-button-interactive-text: var(--sy-text--yellow);
	}
	@media (hover: hover) {
		.sy-button--hover-green:not(.sy-button--hover-actions-disabled):hover {
			color: var(--sy-text--green);
		}
		.sy-button--hover-blue:not(.sy-button--hover-actions-disabled):hover {
			color: var(--sy-text--blue);
		}
		.sy-button--hover-red:not(.sy-button--hover-actions-disabled):hover {
			color: var(--sy-text--red);
		}
		.sy-button--hover-yellow:not(.sy-button--hover-actions-disabled):hover {
			color: var(--sy-text--yellow);
		}
	}
	.sy-button--center {
		display: flex;
		justify-content: center;
		align-items: center;
	}
	.sy-button--mobile {
		min-height: var(--sy-mobile-touch-target);
		min-width: var(--sy-mobile-touch-target);
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}
	.sy-button--mobile.sy-button--filled {
		border: var(--sy-mobile-surface-border);
		box-shadow: none;
	}
	.sy-button--mobile.sy-button--filled:active {
		background-color: var(--sy-mobile-state-pressed);
		box-shadow: none;
	}
	@media (hover: hover) {
		.sy-button--mobile.sy-button--filled:not(.sy-button--hover-actions-disabled):hover {
			box-shadow: none;
		}
	}
	.sy-button--mobile.sy-button--small {
		font-size: 0.8125rem;
	}
	.sy-button--filled-color {
		background-color: var(--sy-button-filled-background);
		color: var(--sy-text--on-fill);
	}
	@media (hover: hover) {
		.sy-button--filled-color:not(.sy-button--hover-actions-disabled):hover {
			background-color: var(--sy-color--grey-2);
			color: var(--sy-button-interactive-text);
		}
	}
	.sy-button--filled-color:active {
		background-color: var(--sy-color--grey-2);
		color: var(--sy-button-interactive-text);
	}
	.sy-button--filled-color:disabled,
	.sy-button--filled-color:disabled:hover {
		background-color: var(--sy-color--grey-2);
		color: var(--sy-color--grey-5);
	}
</style>
