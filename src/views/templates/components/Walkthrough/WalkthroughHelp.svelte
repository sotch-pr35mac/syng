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
		size="small"
		onclick={(event) => {
			event.stopPropagation();
			void walkthroughStore.start(guide, context);
		}}
	>
		{label}
	</SyButton>
{/if}
