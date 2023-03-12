<script>
import { createEventDispatcher, onDestroy } from 'svelte';

/* Dropdown Values Prop */
// The values to be present in the dropdown list.
// Values should be an array of objects in the follow form:
// [
//   {
//     text: 'Value to display', // if applicable
//     icon: SvelteComponent, // if applicable
//     id: 'unique identifier',
//     component: SvelteComponent // One of the supported SyDropdown Item components 
//     color: 'some color',
//     hover: 'some hover color'
//   } 
// ]
export let values = [];

/* Position Prop */
/* Possible Values */
// 'right' - Right aligned to the dropdown trigger
// 'left' - Left aligned to the dropdown trigger
export let position = 'left';

// Generate a random ID for this dropdown
const dropId = Math.floor(Math.random() * 100);

// Cache the element
const thisDropdown = document.getElementById(dropId);

// Whether or not the dropdown is "open".
let active = false;

const dispatch = createEventDispatcher();
const handleClick = e => {
	if(!e.composedPath().includes(thisDropdown)) {
		active = false;
	}
};
const handleSelect = id => {
	if(id) {
		dispatch('selection', id);
		active = false;
	}
};
const toggleDropdown = () => {
	active = !active;
};

// Close the dropdown if the user clicks outside of it
$: if(active) {
	document.addEventListener('click', handleClick, { capture: true });
} else {
	document.removeEventListener('click', handleClick, { capture: true });
}
onDestroy(() => {
	document.removeEventListener('click', handleClick, { capture: true });
});

const getListClasses = () => {
	return ['sy-dropdown--list',
		`sy-dropdown--list--${position}`].join(' ');
};
</script>

<style>
.sy-dropdown--container {
	display: inline-block;
	position: relative;
}
.sy-dropdown--list {
	position: absolute;
	width: max-content;
	background-color: var(--sy-color--white);
	border-radius: var(--sy-border-radius);
	z-index: var(--sy-z-index--top-3);
	box-sizing: border-box;
	box-shadow: var(--sy-shadow--active);
	visibility: hidden;
	opacity: 0;
	transition: all ease;
	transition-duration: var(--sy-transition-duration);
	margin-top: var(--sy-space);
}
.sy-dropdown--list--content {
	display: flex;
	flex-direction: column;
	overflow-y: scroll;
	height: max-content;
	max-height: 85vh;
}
.sy-dropdown--list--left {
	left: 0;
}
.sy-dropdown--list--right {
	right: 0;
}
.sy-dropdown--active .sy-dropdown--list {
	visibility: visible;
	opacity: 1;
}
</style>

<div class="sy-dropdown--container" class:sy-dropdown--active="{ active }" id="{ dropId }">
	<span class="sy-dropdown--trigger" on:click="{ toggleDropdown }" on:keyup="{ toggleDropdown }">
		<slot></slot>
	</span>
	<div class="{ getListClasses() }">
		<div class="sy-dropdown--list--content">
			{#each values as value}
				<!-- eslint-disable-next-line no-unused-vars -->
				<svelte:component this="{value.component}" text="{value.text}" icon="{value.icon}" color="{value.color}" hover="{value.hover}" on:click="{ e => handleSelect(value.id, e) }" />
			{/each}
		</div>
	</div>
</div>