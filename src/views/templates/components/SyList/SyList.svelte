<script>
import SyListContent from './SyListContent.svelte';
import SyListPreview from './SyListPreview.svelte';

/* Style Prop */
/* Possible Values */
// 'preview' - Preview Content List Style

/* Content-Style Component Prop */

/**
 * @typedef {Object} Props
 * @property {string} [style] - 'content' - Content List Style
 * @property {any} [values] - Values Prop
 * @property {any} [component] - This is prop is required when the style is content
 * @property {any} [highlight] - Highlight Prop
 * @property {boolean} [filterable] - Filterable Prop
 * @property {(detail: any) => void} [onselection] - Selection callback
 * @property {(detail: any) => void} [onevent] - Event callback
 */

/** @type {Props} */
const {
	style = 'content',
	values = [],
	component = undefined,
	highlight = undefined,
	filterable = false,
	onselection,
	onevent,
} = $props();

const styleMap = {
	preview: SyListPreview,
	content: SyListContent,
};

const SvelteComponent = $derived(styleMap[style]);
</script>

<SvelteComponent
  {values}
  {component}
  {onselection}
  {highlight}
  {filterable}
  {onevent}
/>
