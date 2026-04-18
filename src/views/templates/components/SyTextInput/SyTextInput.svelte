<script>
	/* Style Prop */
	/* Possible Values */
	// 'ghost' - 'Invisible' text box

	/* Size Prop */
	/* Possible Values */
	// 'small' - Small text field
	// 'medium' - Medium text field (Default Value)
	// 'large' - Large text field

	/* Transparency Prop */
	/* Possible Values */
	// true - Element will be transparent

	/**
	 * @typedef {Object} Props
	 * @property {string} [style] - 'standard' - Standard text box styling
	 * @property {string} [size] - 'extra-large' - Extra large text field
	 * @property {boolean} [transparency] - false - Element will have standard background
	 * @property {string} [placeholder] - Placeholder Prop
	 * @property {string} [type] - Type Prop
	 * @property {any} id - ID Prop
	 * @property {any} [spellcheck] - Spellcheck Prop
	 * @property {(value: string) => void} [onchange] - Change handler
	 * @property {(value: string) => void} [onkeyup] - Keyup handler
	 * @property {(value: string) => void} [oninput] - Input handler
	 * @property {(event: Event) => void} [onenter] - Enter key handler
	 */

	import { isMobile } from '../../utils/device.js';

	// Optimized for mobile: 16px minimum font size prevents iOS auto-zoom on focus.
	const mobile = isMobile();

	/** @type {Props} */
	const {
		style = 'standard',
		size = 'medium',
		transparency = false,
		placeholder = '',
		type = 'text',
		id,
		spellcheck = undefined,
		onchange = () => {},
		onkeyup = () => {},
		oninput = () => {},
		onenter = () => {},
	} = $props();
	const getClasses = () => {
		return [
			'sy-text-input',
			transparency ? 'sy-text-input--transparency' : '',
			`sy-text-input--${style}`,
			`sy-text-input--${size}`,
			mobile ? 'sy-text-input--mobile' : '',
		].join(' ');
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
	{placeholder}
	{type}
	class={getClasses()}
	{id}
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
	.sy-text-input--transparency {
		background-color: rgba(0, 0, 0, 0);
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
