<script>
	import SyListPreviewItem from './SyListPreviewItem.svelte';

	/* Values Prop */
	export let values = [];
</script>

{#each values as value }
	<SyListPreviewItem headline="{value.headline}" subtitle="{value.subtitle}" content="{value.content}" active="{value.active}" />
{/each}
