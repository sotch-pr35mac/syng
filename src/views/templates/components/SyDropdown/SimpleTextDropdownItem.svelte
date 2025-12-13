<script>
/* Text Prop */

/* Color Prop */
// Color of the text
// Possible Values:

/* Hover Prop */
// Color of the text on hover
// Possible Values:

/**
 * @typedef {Object} Props
 * @property {any} [text] - The value to be displayed
 * @property {string} [color] - 'black'
 * @property {string} [hover] - 'blue'
 * @property {any} [icon] - Suppress the unexpected prop warning
 * @property {(e: Event) => void} [onclick] - Click handler
 */

/** @type {Props} */
let {
  text = undefined,
  color = "black",
  hover = "blue",
  icon: _icon = undefined,
  onclick = () => {},
} = $props();

const getClasses = () => {
  return [
    "st-dropdown-item--container",
    `st-dropdown-item--color--${color}`,
    `st-dropdown-item--hover--${hover}`,
  ].join(" ");
};

const handleClick = (e) => {
  onclick(e);
};
</script>

<span
  class={getClasses()}
  role="button"
  tabindex="0"
  onclick={handleClick}
  onkeyup={handleClick}
>
  {text}
</span>

<style>
.st-dropdown-item--container {
  cursor: pointer;
  padding: var(--sy-space--large);
  transition: all ease-in-out;
  transition-duration: var(--sy-transition-duration) / 2;
}
.st-dropdown-item--container:first-child,
.st-dropdown-item--container:last-child {
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
