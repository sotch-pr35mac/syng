<script lang="ts">
	import { searchStore } from '@/composables/search.svelte.js';
</script>

{#if searchStore.status === 'ready' && !searchStore.fullResults.length}
	<p>No results found. Try another word in Chinese, English, or pinyin.</p>
{/if}

<style>
	p {
		padding: var(--sy-space--large);
		color: var(--sy-color--grey-5);
	}
</style>
