<script lang="ts">
	// Startup coordinator, distinct from the replayable WhatsNew route: wait for onboarding
	// and recovery, offer pending notes, then release the router even if navigation fails.
	import type { Snippet } from 'svelte';
	import RouteLoading from '@/components/RouteLoading/RouteLoading.svelte';
	import { whatsNewStore } from '@/stores/whatsNew.svelte.js';

	const {
		ready,
		blocked,
		children,
	}: {
		ready: boolean;
		blocked: boolean;
		children: Snippet;
	} = $props();
	let released = $state(false);

	$effect(() => {
		if (!ready || blocked || released) {
			return undefined;
		}
		let active = true;
		void whatsNewStore
			.openPending()
			.catch(() => {})
			.finally(() => {
				if (active) {
					released = true;
				}
			});
		return () => {
			active = false;
		};
	});
</script>

{#if released}
	{@render children()}
{:else}
	<RouteLoading />
{/if}
