<script>
/* FAQ
 * Q: How do I get a button within a drodown trigger to respect first-child/last-child behavior?
 * A: You can add the `sy-button--grouped--first` / `sy-button--grouped--last` directly to the button.
 */

/* Size Prop */
/* Possible Values */
/* large */
/* medium */
/* small */
export let size = 'medium';

const getClasses = () => {
	return ['sy-button-bar--container',
		`sy-button-bar--container--${size}`].join(' ');
};
</script>

<style>
.sy-button-bar--container {
	padding: var(--sy-space--large);
}

/* Styles for a button placed directly in a button bar */
:global(.sy-button-bar--container--small > .sy-button) {
	padding: var(--sy-space--small) var(--sy-space);
}
:global(.sy-button-bar--container--medium > .sy-button) {
	padding: var(--sy-space) var(--sy-space--large);
}
:global(.sy-button-bar--container--large > .sy-button) {
	padding: var(--sy-space--large) var(--sy-space--extra-large);
}
:global(.sy-button-bar--container > .sy-button--grouped:first-child) {
	border-radius: var(--sy-space) 0px 0px var(--sy-space);
	border-right: none;
}
:global(.sy-button-bar--container > .sy-button--grouped:last-child) {
	border-radius: 0px var(--sy-space) var(--sy-space) 0px;
	border-left: none;
}
:global(.sy-button-bar--container > .sy-button--grouped:not(:first-child),
		.sy-button-bar--container > .sy-button--grouped:not(:last-child)) {
	border-left: none;
	border-right: none;
}

/* Styles for a button placed within a dropdown trigger within a button bar */
:global(.sy-button-bar--container--small > .sy-dropdown--container > .sy-dropdown--trigger > .sy-button) {
	padding: var(--sy-space--small) var(--sy-space);
}
:global(.sy-button-bar--container--medium > .sy-dropdown--container > .sy-dropdown--trigger > .sy-button) {
	padding: var(--sy-space) var(--sy-space--large);
}
:global(.sy-button-bar--container--large > .sy-dropdown--container > .sy-dropdown--trigger > .sy-button) {
	padding: var(--sy-space--large) var(--sy-space--extra-large);
}
:global(.sy-button-bar--container > .sy-dropdown--container > .sy-dropdown--trigger  > .sy-button--grouped--first) {
	border-radius: var(--sy-space) 0px 0px var(--sy-space);
	border-right: none;
}
:global(.sy-button-bar--container > .sy-dropdown--container > .sy-dropdown--trigger > .sy-button--grouped--last) {
	border-radius: 0px var(--sy-space) var(--sy-space) 0px;
	border-left: none;
}
:global(.sy-button-bar--container > .sy-dropdown--container > .sy-dropdown--trigger > .sy-button--grouped:not(.sy-button--grouped--first),
		.sy-button-bar--container > .sy-dropdown--container > .sy-dropdown--trigger > .sy-button--grouped:not(.sy-button--grouped--last)) {
	border-left: none;
	border-right: none;
}
</style>

<div class="{ getClasses() }">
	<slot></slot>
</div>