<script>
import { suppressUnusedExportLet } from '../../utils/';

/* Values Prop */
export let values = [];

/* Component Prop */
// The component to render as a list item
// The component must accept a value prop
export let component;

// Suppress the unexpected prop warning
export let highlight = undefined;
suppressUnusedExportLet(highlight);
</script>

<style>
.sy-list--container {
    background-color: var(--sy-color--white);
    border-radius: var(--sy-border-radius);
    box-shadow: var(--sy-inner-shadow);
    padding: var(--sy-space);
    margin: var(--sy-space--extra-large);
}
.sy-list--list-item {
    border-top: var(--sy-border);
    border-bottom: var(--sy-border);
}
.sy-list--list-item:first-child {
	border-top: none;
}
.sy-list--list-item:last-child {
	border-bottom: none;
}
</style>

<div class="sy-list--container">
    {#each values as value}
        <div class="sy-list--list-item">
            <svelte:component this={component} value="{value}" on:event/>
        </div>
    {/each}
</div>
