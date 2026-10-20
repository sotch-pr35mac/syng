<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';

	/* Checked Prop */
	/* Possible Values */
	// true - The toggle is in the 'on' position

	/* ID Prop */

	/* Value Prop */

	/**
	 * @typedef {Object} Props
	 * @property {boolean} [checked] - false - The toggle is in the 'off' position
	 * @property {string} [id] - HTML ID for reference
	 * @property {any} [value] - The value property for the HTML checkbox
	 * @property {string} [accessibleLabel] - Accessible name for the checkbox
	 * @property {boolean} [disabled] - Whether the toggle can be changed
	 * @property {(checked: boolean) => void} [onchange] - Change handler
	 */
	interface Props extends Omit<HTMLInputAttributes, 'type' | 'onchange'> {
		accessibleLabel?: string;
		onchange?: (checked: boolean) => void;
	}

	/** @type {Props} */
	const {
		checked = false,
		id = crypto.randomUUID(),
		value,
		accessibleLabel = 'Toggle',
		disabled = false,
		'aria-label': nativeLabel,
		'aria-labelledby': labelledby,
		class: className,
		onchange,
		...restProps
	}: Props = $props();
</script>

<span class="sy-toggle--container" class:sy-toggle--container--disabled={disabled}>
	<input
		{...restProps}
		type="checkbox"
		{id}
		class={['sy-toggle', className]}
		{value}
		{checked}
		{disabled}
		aria-label={nativeLabel ?? (labelledby ? undefined : accessibleLabel)}
		aria-labelledby={labelledby}
		onchange={(event) => onchange?.(event.currentTarget.checked)}
	/>
	<label for={id} class="sy-toggle--label">{accessibleLabel}</label>
</span>

<style>
	.sy-toggle--container {
		display: flex;
		position: relative;
	}
	.sy-toggle--container--disabled {
		opacity: 0.5;
	}
	.sy-toggle {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		clip-path: inset(50%);
		white-space: nowrap;
		border: 0;
	}
	.sy-toggle:focus-visible + .sy-toggle--label {
		outline: var(--sy-focus-width) solid var(--sy-toggle--focus, var(--sy-focus-color));
		outline-offset: var(--sy-focus-offset);
	}
	.sy-toggle:global(.sy-focus-visible) + .sy-toggle--label {
		outline: var(--sy-focus-width) solid var(--sy-toggle--focus, var(--sy-focus-color));
		outline-offset: var(--sy-focus-offset);
	}
	.sy-toggle:checked + .sy-toggle--label {
		background: var(--sy-toggle--track-on, var(--sy-fill--blue));
	}
	.sy-toggle:checked + .sy-toggle--label:after {
		left: calc(100% - 0.09765625rem);
		transform: translateX(-100%);
	}
	.sy-toggle--label {
		cursor: pointer;
		text-indent: -9999px;
		width: 3.90625rem;
		height: 1.9453125rem;
		border-radius: 1.9453125rem;
		background: var(--sy-toggle--track-off, var(--sy-control--track-off));
		display: block;
		position: relative;
		flex-shrink: 0;
	}
	.sy-toggle--label:after {
		content: '';
		position: absolute;
		top: 0.09765625rem;
		left: 0.09765625rem;
		width: 1.7578125rem;
		height: 1.7578125rem;
		border-radius: 1.7578125rem;
		background: var(--sy-toggle--knob, var(--sy-control--knob));
		transition: var(--sy-transition-duration);
	}
	.sy-toggle--label:active:after {
		width: 2.5390625rem;
	}
	.sy-toggle:disabled + .sy-toggle--label {
		cursor: not-allowed;
	}
</style>
