<script>
	/* Style Prop */
	/* Possible Values */
	// 'ghost' - 'Invisible' text box

	/* Size Prop */
	/* Possible Values */
	// 'small' - Small text field
	// 'medium' - Medium text field (Default Value)
	// 'large' - Large text field

	/**
	 * @typedef {Object} Props
	 * @property {string} [style] - 'standard' - Standard text box styling
	 * @property {string} [size] - 'extra-large' - Extra large text field
	 * @property {string} [placeholder] - Placeholder Prop
	 * @property {string} [value] - Controlled input value
	 * @property {string} [type] - Type Prop
	 * @property {string} [autocomplete] - Autocomplete Prop
	 * @property {string} [autocorrect] - Autocorrect Prop ('off' by default to stop pinyin being "corrected")
	 * @property {string} [autocapitalize] - Autocapitalize Prop ('off' by default)
	 * @property {string} [inputmode] - Input mode Prop
	 * @property {any} id - ID Prop
	 * @property {any} [spellcheck] - Spellcheck Prop
	 * @property {any[]} [classes] - Additional class names
	 * @property {number} [maxlength] - Maximum character length
	 * @property {(value: string) => void} [onchange] - Change handler
	 * @property {(value: string) => void} [onkeyup] - Keyup handler
	 * @property {(value: string) => void} [oninput] - Input handler
	 * @property {(event: Event) => void} [onenter] - Enter key handler
	 */

	import { isMobile } from '@/utils/device.js';
	import { cursorToEnd } from '@/actions/cursorToEnd.svelte.js';

	// Optimized for mobile: 16px minimum font size prevents iOS auto-zoom on focus.
	const mobile = isMobile();

	/** @type {Props} */
	const {
		style = 'standard',
		size = 'medium',
		placeholder = '',
		value = '',
		type = 'text',
		autocomplete = undefined,
		// Default to disabling autocorrect/autocapitalize so the keyboard stops
		// "correcting" pinyin into English. Exceptions (e.g. reader titles) opt back in.
		autocorrect = 'off',
		autocapitalize = 'off',
		inputmode = undefined,
		id,
		maxlength = undefined,
		spellcheck = false,
		classes = [],
		onchange = () => {},
		onkeyup = () => {},
		oninput = () => {},
		onenter = () => {},
	} = $props();
	const getClasses = () => {
		return classes
			.concat([
				'sy-text-input',
				`sy-text-input--${style}`,
				`sy-text-input--${size}`,
				mobile ? 'sy-text-input--mobile' : '',
			])
			.join(' ');
	};
	const handleKeyup = (event) => {
		if (event.code === 'Enter') {
			onenter(event);
		} else {
			onkeyup(event.currentTarget.value);
		}
	};
	const handleInput = (event) => {
		oninput(event.currentTarget.value);
	};
</script>

<input
	use:cursorToEnd
	{placeholder}
	{value}
	{type}
	{autocomplete}
	{autocorrect}
	{autocapitalize}
	{inputmode}
	class={getClasses()}
	{id}
	{maxlength}
	{spellcheck}
	onchange={(e) => onchange(e.currentTarget.value)}
	oninput={handleInput}
	onkeyup={handleKeyup}
/>

<style>
	.sy-text-input {
		border: none;
		padding: 0px;
		margin: calc(var(--sy-space--small) + var(--sy-space--large))
			calc(var(--sy-space--small) + var(--sy-space));
		background-color: var(--sy-color--white);
		color: var(--sy-color--black);
	}
	.sy-text-input::placeholder {
		color: var(--sy-color--grey-1);
	}
	.sy-text-input--standard {
		border-radius: var(--sy-border-radius);
		border: var(--sy-border);
		padding: var(--sy-space);
		box-shadow: var(--sy-inner-shadow);
	}
	.sy-text-input--ghost {
		height: 100%;
		display: flex;
		flex: 1;
	}
	.sy-text-input--ghost:focus {
		outline: none;
	}
	.sy-text-input--large {
		font-size: 16px;
	}
	.sy-text-input--extra-large {
		font-size: 18px;
	}
	.sy-text-input--mobile {
		font-size: var(--sy-font-size--mobile-large);
		min-height: var(--sy-mobile-touch-target);
	}
	.sy-text-input--mobile.sy-text-input--standard {
		border: var(--sy-mobile-surface-border);
		box-shadow: none;
	}
</style>
