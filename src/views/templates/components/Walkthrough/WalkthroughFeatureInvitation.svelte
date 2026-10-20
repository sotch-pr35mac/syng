<script lang="ts">
	import { untrack } from 'svelte';
	import { walkthroughStore } from '@/stores/walkthrough.svelte.js';
	import type { FeatureWalkthroughId, WalkthroughContext } from '@/types/walkthrough.js';

	const {
		guide,
		context,
		ready,
	}: {
		guide: FeatureWalkthroughId;
		context: WalkthroughContext;
		ready: boolean;
	} = $props();

	$effect(() => {
		if (
			ready &&
			walkthroughStore.loaded &&
			!walkthroughStore.blocked &&
			!walkthroughStore.visible
		) {
			const identifier = guide;
			const selection = context;
			untrack(() => walkthroughStore.offerFeature(identifier, selection));
		}
	});
</script>
