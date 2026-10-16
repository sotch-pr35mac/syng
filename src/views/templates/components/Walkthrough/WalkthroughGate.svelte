<script lang="ts">
	import { onMount } from 'svelte';
	import { walkthroughStore } from '@/stores/walkthrough.svelte.js';
	const {
		ready,
		startupReady,
		blocked,
	}: { ready: boolean; startupReady: boolean; blocked: boolean } = $props();
	let preferencesReady = $state(false);
	$effect(() => {
		if (!startupReady) {
			return undefined;
		}
		let active = true;
		void walkthroughStore
			.load()
			.then(() => {
				if (active) {
					preferencesReady = true;
				}
				return undefined;
			})
			.catch(() => {
				/* A guide must never prevent the application from opening. */
			});
		return () => {
			active = false;
		};
	});
	onMount(() => {
		const handleRoute = () => walkthroughStore.routeChanged();
		window.addEventListener('hashchange', handleRoute);
		return () => {
			window.removeEventListener('hashchange', handleRoute);
			walkthroughStore.interrupt();
		};
	});
	$effect(() => {
		walkthroughStore.setBlocked(blocked || !ready || !startupReady);
		if (preferencesReady && startupReady && ready && !blocked) {
			walkthroughStore.offer();
		}
	});
</script>

{#if ready && startupReady && !blocked && walkthroughStore.visible}
	{#await import('@/components/Walkthrough/WalkthroughHost.svelte')}
		<div class="guide-loading" role="status">
			Opening guide… <button onclick={walkthroughStore.skip}>Skip tour</button>
		</div>
	{:then module}
		<module.default />
	{:catch}
		<div class="guide-loading" role="alert">
			The guide could not load. <button onclick={walkthroughStore.skip}>Close guide</button>
		</div>
	{/await}
{/if}

<style>
	.guide-loading {
		position: fixed;
		bottom: max(16px, env(safe-area-inset-bottom));
		right: 16px;
		z-index: var(--sy-z-index--top);
		padding: 16px;
		background: var(--sy-color--white);
		color: var(--sy-color--black);
		font-family: var(--sy-font-family);
		border-radius: var(--sy-border-radius);
		box-shadow: var(--sy-shadow--active);
	}
	button {
		min-height: 44px;
		margin-left: 12px;
	}
</style>
