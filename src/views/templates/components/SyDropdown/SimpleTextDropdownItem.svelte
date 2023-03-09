<script>
import { createEventDispatcher } from 'svelte';
import { suppressUnusedExportLet } from '../../utils/';

/* Text Prop */
// The value to be displayed
export let text = undefined;

/* Color Prop */
// Color of the text
// Possible Values:
// 'black'
export let color = 'black';

/* Hover Prop */
// Color of the text on hover
// Possible Values:
// 'blue'
export let hover = 'blue';

// Suppress the unexpected prop warning
export let icon = undefined;
suppressUnusedExportLet(icon);

const getClasses = () => {
	return ['st-dropdown-item--container',
		`st-dropdown-item--color--${color}`,
		`st-dropdown-item--hover--${hover}`].join(' ');
};

const dispatch = createEventDispatcher();
const handleClick = e => {
	dispatch('click', e);
};
</script>

<style>
.st-dropdown-item--container {
  cursor: pointer;
  padding: var(--sy-space--large);
  transition: all ease-in-out;
  transition-duration: var(--sy-transition-duration) / 2;
}
.st-dropdown-item--container:first-child, .st-dropdown-item--container:last-child {
  border-radius: var(--sy-border-radius);
}
.st-dropdown-item--container:hover {
  background-color: var(--sy-color--grey-2);
}
.st-dropdown-item--color--black {
  color: var(--sy-color--black);
}
.st-dropdown-item--hover--blue:hover {
  color: var(--sy-color--blue);
}
</style>

<span class="{ getClasses() }" on:click="{ handleClick }" on:keyup="{ handleClick }">
  { text }
</span>