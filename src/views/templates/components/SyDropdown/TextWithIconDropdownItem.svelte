<script>
/* Icon Prop */

/* Text Prop */

/* Hover Prop */
// Color of text and icon on hover
// Defaults to blue
// Possible Values:
// 'blue'
// 'green'

/* Color Prop */
// Color of the text and icon
// Defaults to black
// Possible Values:
// 'blue'

/**
 * @typedef {Object} Props
 * @property {any} [icon] - The icon component to use
 * @property {string} [text] - The text value to display
 * @property {string} [hover] - 'red'
 * @property {string} [color] - 'black'
 * @property {(e: Event) => void} [onclick] - Click handler
 */

/** @type {Props} */
const {
	icon = undefined,
	text = '',
	hover = 'blue',
	color = 'black',
	onclick = () => {},
} = $props();

const getClasses = () => {
	return [
		'twi-dropdown-item--container',
		`twi-dropdown-item--color--${color}`,
		`twi-dropdown-item--hover--${hover}`,
	].join(' ');
};
const handleClick = (e) => {
	onclick(e);
};

const SvelteComponent = $derived(icon);
</script>

<span
  class={getClasses()}
  role="button"
  tabindex="0"
  onclick={handleClick}
  onkeyup={handleClick}
>
  <SvelteComponent size="14" />
  &nbsp;
  <span>{text}</span>
</span>

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
.twi-dropdown-item--container:first-child,
.twi-dropdown-item--container:last-child {
  border-radius: var(--sy-border-radius);
}
.twi-dropdown-item--container:hover {
  background-color: var(--sy-color--grey-2);
}
</style>
