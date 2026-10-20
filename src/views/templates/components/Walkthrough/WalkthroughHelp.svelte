<script lang="ts">
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import { walkthroughStore } from '@/stores/walkthrough.svelte.js';
	import type { WalkthroughId, WalkthroughContext } from '@/types/walkthrough.js';
	const {
		guide,
		label,
		context = {},
	}: {
		guide: WalkthroughId;
		label: string;
		context?: WalkthroughContext;
	} = $props();
</script>

{#if !walkthroughStore.hasCompleted(guide)}
	<SyButton
		style="ghost"
		size="medium"
		classes={['walkthrough-help']}
		onclick={(event) => {
			event.stopPropagation();
			void walkthroughStore.start(guide, context);
		}}
	>
		{label}
	</SyButton>
{/if}

<style>
	:global(.sy-button.sy-button--medium.walkthrough-help) {
		font-size: 0.875rem;
	}
</style>
