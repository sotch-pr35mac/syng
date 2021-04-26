<script>
/* Size Prop */
/* Possible Values */
/* large */
/* medium */
/* small */
export let size = 'medium';

const getClasses = () => {
    return [`sy-button-bar--container`,
            `sy-button-bar--container--${size}`].join(' ');
}
</script>

<style>
.sy-button-bar--container {
    padding: var(--sy-space--large);
}
:global(.sy-button-bar--container--small > .sy-button) {
    padding: var(--sy-space-small) var(--sy-space);
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
</style>

<div class="{ getClasses() }">
    <slot></slot>
</div>
