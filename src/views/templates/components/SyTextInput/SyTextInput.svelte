<script>
import { createEventDispatcher } from 'svelte';

/* Style Prop */
/* Possible Values */
// 'ghost' - 'Invisible' text box
// 'standard' - Standard text box styling
export let style = 'standard';

/* Size Prop */
/* Possible Values */
// 'small' - Small text field
// 'medium' - Medium text field (Default Value)
// 'large' - Large text field
// 'extra-large' - Extra large text field
export let size = 'medium';

/* Transparency Prop */
/* Possible Values */
// true - Element will be transparent
// false - Element will have standard background
export let transparency = false;

/* Placeholder Prop */
export let placeholder = '';

/* Type Prop */
export let type = 'text';

/* ID Prop */
export let id;

/* Spellcheck Prop */
export let spellcheck = undefined;

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

<input placeholder="{placeholder}" type="{type}" class="{getClasses()}" id={id} spellcheck={spellcheck} on:change={ e => dispatch('change', e.srcElement.value) } on:keyup={ handleKeyup }/>
