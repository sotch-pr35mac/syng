<script lang="ts">
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import { walkthroughStore } from '@/stores/walkthrough.svelte.js';
	import type { WalkthroughId, WalkthroughContext } from '@/types/walkthrough.js';
	const { guide, context = {} }: { guide: WalkthroughId; context?: WalkthroughContext } =
		$props();
</script>

<SyButton
	style="ghost"
	size="small"
	classes={['walkthrough-help']}
	onclick={(event) => {
		event.stopPropagation();
		void walkthroughStore.start(guide, context);
	}}
>
	Show me how
</SyButton>

<style>
	:global(.walkthrough-help) {
		min-height: 44px;
		font-size: var(--sy-font-size--small);
		white-space: nowrap;
	}
	:global(.walkthrough-help:focus-visible) {
		outline: 2px solid var(--sy-color--blue-2);
		outline-offset: 2px;
	}
</style>
