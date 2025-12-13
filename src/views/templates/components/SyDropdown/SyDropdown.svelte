<script>


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


/* Position Prop */
/* Possible Values */
// 'right' - Right aligned to the dropdown trigger

	/**
	 * @typedef {Object} Props
	 * @property {any} [values] - ]
	 * @property {string} [position] - 'left' - Left aligned to the dropdown trigger
	 * @property {import('svelte').Snippet} [children]
	 * @property {(id: any) => void} [onselection] - Selection handler
	 */

	/** @type {Props} */
	let { values = [], position = 'left', children, onselection = () => {} } = $props();

// Generate a random ID for this dropdown
const dropId = Math.floor(Math.random() * 100);

// Cache the element
const thisDropdown = document.getElementById(dropId);

// Whether or not the dropdown is "open".
let active = $state(false);

const handleClick = e => {
	if(!e.composedPath().includes(thisDropdown)) {
		active = false;
	}
};
const handleSelect = id => {
	if(id) {
		onselection(id);
		active = false;
	}
};
const toggleDropdown = () => {
	active = !active;
};

// Close the dropdown if the user clicks outside of it
// $effect automatically handles cleanup when the component is destroyed
$effect(() => {
	if (active) {
		document.addEventListener('click', handleClick, { capture: true });
		return () => {
			document.removeEventListener('click', handleClick, { capture: true });
		};
	}
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
	<span class="sy-dropdown--trigger" onclick={toggleDropdown} onkeyup={toggleDropdown}>
		{@render children?.()}
	</span>
	<div class="{ getListClasses() }">
		<div class="sy-dropdown--list--content">
		{#each values as value}
			<value.component text={value.text} icon={value.icon} color={value.color} hover={value.hover} onclick={(e) => handleSelect(value.id, e)} />
		{/each}
		</div>
	</div>
</div>