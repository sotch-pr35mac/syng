<script>
import { createEventDispatcher } from 'svelte';

/* Style Prop */
/* Possible Values */
// 'ghost' - No background or shadow
// 'filled' - With background and shadow
export let style = 'filled';

/* Size Prop */
/* Possible Values */
// 'small' - Small button
// 'medium' - Medium button
// 'large' - Large button
export let size = 'medium';

/* Shape Prop */
/* Possible Values */
// 'rectangle' - Rectangular
// 'circle' - Circular
export let shape = 'rectangle';

/* Disabled Prop */
/* Possible Values */
// true
// false
export let disabled = false;

const dispatch = createEventDispatcher();
const getClasses = () => {
	return ['sy-button', 
		`sy-button--${style}`,
		`sy-button--${size}`,
		`sy-button--${shape}`].join(' ');
}
</script>

<style>
.sy-button {
	margin: 0 var(--sy-space);
	padding: var(--sy-space);
	border: none;
	cursor: pointer;
	color: var(--sy-color--black);
	font-family: var(--sy-font-family);
}
.sy-button:focus {
	outline: none;
}
.sy-button:disabled {
	color: var(--sy-color--grey-5);
	cursor: not-allowed;
}
.sy-button--filled {
	box-shadow: var(--sy-shadow);
}
.sy-button--ghost {
	background: none;	
}
.sy-button--ghost:hover {
	color: var(--sy-color--blue);
	transition-property: color;
	transition-duration: var(--sy-transition-duration);
}
.sy-button--ghost:hover:disabled {
	color: var(--sy-color--grey-5);
}
.sy-button--small {
	font-size: 10px;
}
.sy-button--medium {
	font-size: 13px;
}
.sy-button--large {
	font-size: 16px;
}
.sy-button--rectangle {
	border-radius: var(--sy-border-radius);
}
.sy-button--circle {
	border-radius: 50%;
}
</style>

<button class="{getClasses()}" on:click={ () => dispatch('click') } disabled={ disabled }>
	<slot></slot>
</button>
