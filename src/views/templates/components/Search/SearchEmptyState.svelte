<script lang="ts">
	import { searchStore } from '@/composables/search.svelte.js';
	import Awa, { AWA_SIZES } from '@/components/Awa/Awa.svelte';

	const { variant = 'desktop' }: { variant?: 'desktop' | 'mobile' } = $props();
</script>

{#if searchStore.status === 'ready' && !searchStore.fullResults.length}
	<div class="search-empty-state" class:search-empty-state--mobile={variant === 'mobile'}>
		<div class="search-empty-state__mascot">
			<Awa pose="search" size={AWA_SIZES.list} />
		</div>
		<p>No results found. Try another word in Chinese, English, or pinyin.</p>
	</div>
{/if}

<style>
	.search-empty-state {
		display: flex;
		flex: 1;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: var(--sy-space--large);
		padding-bottom: calc(var(--sy-space--large) + min(12vh, 100px));
		color: var(--sy-text--dark);
		font-family: var(--sy-font-family);
		text-align: center;
	}

	.search-empty-state__mascot {
		flex-shrink: 0;
		margin-bottom: var(--sy-space--large);
	}

	p {
		margin: 0;
		font-size: 0.8125rem;
		font-weight: var(--sy-font-weight--normal);
		line-height: var(--sy-line-height--body);
	}

	.search-empty-state--mobile {
		justify-content: flex-start;
		padding-bottom: var(--sy-space--large);
	}

	/* Match Bookmarks' upward bias within the visible portion of the mobile sheet. */
	.search-empty-state--mobile::before,
	.search-empty-state--mobile::after {
		content: '';
		flex: 2;
	}

	.search-empty-state--mobile::after {
		flex: 3;
	}
</style>
