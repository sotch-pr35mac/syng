<script>
import { createEventDispatcher } from 'svelte';
import SyListPreview from './SyListPreview.svelte';
import SyListContent from './SyListContent.svelte';

/* Style Prop */
/* Possible Values */
// 'preview' - Preview Content List Style
// 'content' - Content List Style
export let style = 'content';

/* Values Prop */
export let values = [];

/* Content-Style Component Prop */
// This is prop is required when the style is content
export let component = undefined;

/* Highlight Prop */
export let highlight = true;

const dispatch = createEventDispatcher();
const styleMap = {
	'preview': SyListPreview,
	'content': SyListContent		
};
</script>

<svelte:component this={styleMap[style]} values="{values}" component="{component}" on:selection="{ event => dispatch('selection', event.detail)}" highlight="{highlight}" on:event/>
