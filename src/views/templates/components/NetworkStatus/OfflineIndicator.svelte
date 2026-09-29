<script lang="ts">
	import { WifiOff } from 'lucide-svelte';
	import { isMobile, isIPad } from '@/utils/device.js';
	import { networkStatus } from '@/utils/networkStatus.svelte.js';

	const showOnThisDevice = !isMobile() && !isIPad();
</script>

{#if showOnThisDevice && networkStatus.isOffline}
	<div class="offline-indicator sy-tooltip--container" aria-label="You are Offline" role="status">
		<WifiOff size="18" aria-hidden="true" />
		<div class="sy-tooltip--body sy-tooltip--body-top"><p>You are Offline</p></div>
	</div>
{/if}

<style>
	.offline-indicator {
		position: fixed;
		right: var(--sy-space--extra-large);
		bottom: var(--sy-space--extra-large);
		z-index: var(--sy-z-index--top);
		display: flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		border-radius: 50%;
		background: var(--sy-color--white);
		box-shadow: var(--sy-shadow);
		color: var(--sy-color--grey-4);
	}
</style>
