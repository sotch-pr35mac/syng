<script>
import { createEventDispatcher } from 'svelte';

/* Icon Prop */
// The icon component to use
export let icon = undefined;

/* Text Prop */
// The text value to display
export let text = '';

/* Hover Prop */
// Color of text and icon on hover
// Defaults to blue
// Possible Values:
// 'blue'
// 'green'
// 'red'
export let hover = 'blue';

/* Color Prop */
// Color of the text and icon
// Defaults to black
// Possible Values:
// 'blue'
// 'black'
export let color = 'black';

const dispatch = createEventDispatcher();
const getClasses = () => {
	return ['twi-dropdown-item--container',
		`twi-dropdown-item--color--${color}`,
		`twi-dropdown-item--hover--${hover}`].join(' ');
};
const handleClick = e => {
	dispatch('click', e);
};
</script>

<style>
.twi-dropdown-item--container {
	display: flex;
	align-items: center;
	cursor: pointer;
	padding: var(--sy-space--large);
	transition: all ease-in-out;
	transition-duration: var(--sy-transition-duration) / 2;
}
.twi-dropdown-item--color--blue {
	color: var(--sy-color--blue);
}
.twi-dropdown-item--color--black {
	color: var(--sy-color--black);
}
.twi-dropdown-item--hover--blue:hover {
	color: var(--sy-color--blue);
}
.twi-dropdown-item--hover--green:hover {
	color: var(--sy-color--green-2);
}
.twi-dropdown-item--hover--red:hover {
	color: var(--sy-color--red);
}
.twi-dropdown-item--container:first-child, .twi-dropdown-item--container:last-child {
	border-radius: var(--sy-border-radius);
}
.twi-dropdown-item--container:hover {
	background-color: var(--sy-color--grey-2);
}
</style>

<span class="{ getClasses() }" on:click="{ handleClick }" on:keyup="{ handleClick }">
	<svelte:component this={ icon } size="14" />
	&nbsp;
	<span>{ text }</span>
</span>