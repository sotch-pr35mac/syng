<script>
	import SyListPreview from './SyListPreview.svelte';
	import SyListContent from './SyListContent.svelte';

	/* Style Prop */
	/* Possible Values */
	// 'preview' - Preview Content List Style
	// 'content' - Content List Style
	export let style = 'content';

	/* Values Prop */
	export let values = [];

	const styleMap = {
		'preview': SyListPreview,
		'content': SyListContent		
	};
</script>

<svelte:component this={styleMap[style]} values="{values}" />
