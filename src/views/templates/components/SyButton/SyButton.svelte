<script>
import { createEventDispatcher } from 'svelte';

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

	/**
	 * @typedef {Object} Props
	 * @property {string} [style] - 'filled' - With background and shadow
	 * @property {string} [size] - 'large' - Large button
	 * @property {string} [shape] - 'circle' - Circular
	 * @property {boolean} [disabled] - false
	 * @property {boolean} [grouped] - false
	 * @property {any} [color] - 'yellow'
	 * @property {any} [hover] - 'yellow'
	 * @property {boolean} [center] - false
	 * @property {any} [classes] - A list of classes
	 * @property {import('svelte').Snippet} [children]
	 */

	/** @type {Props} */
	let {
		style = 'filled',
		size = 'medium',
		shape = 'rectangle',
		disabled = false,
		grouped = false,
		color = undefined,
		hover = undefined,
		center = false,
		classes = [],
		children
	} = $props();

const dispatch = createEventDispatcher();
const getClasses = () => {
	return classes.concat(['sy-button', 
		`sy-button--${style}`,
		`sy-button--${size}`,
		`sy-button--${shape}`,
		(center ? 'sy-button--center' : ''),
		(color ? `sy-button--color-${color}` : ''),
		(hover ? `sy-button--hover-${hover}` : ''),
		(grouped ? 'sy-button--grouped' : '')]).join(' ');
};
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
	background-color: var(--sy-color--white);
}
.sy-button--filled:hover {
 	box-shadow: var(--sy-shadow--active);
 	background-color: var(--sy-color--grey-2);
 	transition-property: background-color, box-shadow;
 	transition-duration: var(--sy-transition-duration); 
}
.sy-button--filled:disabled {
 	color: var(--sy-color--grey-5);
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
	color: var(--sy-color--green);
}
.sy-button--color-blue {
	color: var(--sy-color--blue);
}
.sy-button--color-red {
	color: var(--sy-color--red);
}
.sy-button--color-yellow {
	color: var(--sy-color--yellow);
}
.sy-button--hover-green:hover {
	color: var(--sy-color--green);
}
.sy-button--hover-blue:hover {
	color: var(--sy-color--blue);
}
.sy-button--hover-red:hover {
	color: var(--sy-color--red);
}
.sy-button--hover-yellow:hover {
	color: var(--sy-color--yellow);
}
.sy-button--center {
	display: flex;
	justify-content: center;
	align-items: center;
}
</style>

<button class="{getClasses()}" onclick={() => dispatch('click')} disabled={ disabled } data-testid="sy-button">
	{@render children?.()}
</button>