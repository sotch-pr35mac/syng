<script lang="ts">
	import SyModal from '@/components/SyModal/SyModal.svelte';
	import SyToast from '@/components/SyToast/SyToast.svelte';
	import { toolsRoute } from '@/composables/toolsRoute.svelte.js';
</script>

<SyToast
	visible={toolsRoute.showCopyToast}
	message="Copied to clipboard."
	corner="bottom-right"
	ondismiss={toolsRoute.dismissToast}
/>

<SyModal
	title={toolsRoute.activeInfo?.title ?? ''}
	visible={toolsRoute.infoTool !== null}
	onclose={toolsRoute.closeInfo}
>
	{#snippet body()}
		{#if toolsRoute.activeInfo}
			<p class="tools-overlays__info">{toolsRoute.activeInfo.body}</p>
		{/if}
	{/snippet}
</SyModal>

<style>
	.tools-overlays__info {
		max-width: 420px;
		margin: 0;
		line-height: 1.5;
	}
</style>
