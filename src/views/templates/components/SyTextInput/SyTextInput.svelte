<script>
import { createEventDispatcher } from 'svelte';

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
	 */

	/** @type {Props} */
	let {
		style = 'standard',
		size = 'medium',
		transparency = false,
		placeholder = '',
		type = 'text',
		id,
		spellcheck = undefined
	} = $props();

const dispatch = createEventDispatcher();
const getClasses = () => {
	return ['sy-text-input',
		transparency ? 'sy-text-input--transparency' : '',
		`sy-text-input--${style}`,
		`sy-text-input--${size}`].join(' ');
};
const handleKeyup = event => {
	if(event.code == 'Enter') {
		dispatch('enter', event);
	} else {
		dispatch('keyup', event.srcElement.value);
	}
};
</script>

<style>
.sy-text-input {
	border: none;
	padding: 0px;
	margin: calc(var(--sy-space--small) + var(--sy-space--large)) calc(var(--sy-space--small) + var(--sy-space));
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
.sy-text-input--small {
	/* TODO */	
}
.sy-text-input--medium {
	/* TODO */
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
</style>

<input placeholder="{placeholder}" type="{type}" class="{getClasses()}" id={id} spellcheck={spellcheck} onchange={e => dispatch('change', e.srcElement.value)} onkeyup={handleKeyup}/>