<script>
	import SyListContent from '@/components/SyList/SyListContent.svelte';
	import SyListPreview from '@/components/SyList/SyListPreview.svelte';

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
	 * @property {string | number | null} [activeKey] - Controlled active preview row key
	 * @property {string} [filterValue] - Controlled preview filter value
	 * @property {(detail: any) => void} [onselection] - Selection callback
	 * @property {(values: any[]) => void} [onvisiblechange] - Visible preview values callback
	 * @property {(detail: any) => void} [onevent] - Event callback
	 */

	/* eslint-disable prefer-const -- filterValue uses $bindable() which requires let for the entire destructuring */
	/** @type {Props} */
	let {
		style = 'content',
		values = [],
		component = undefined,
		highlight = undefined,
		filterable = false,
		activeKey = undefined,
		filterValue = $bindable(''),
		onselection,
		onvisiblechange,
		onevent,
	} = $props();
	/* eslint-enable prefer-const */

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
	{activeKey}
	bind:filterValue
	{onvisiblechange}
	{onevent}
/>
