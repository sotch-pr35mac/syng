<script lang="ts">
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import { walkthroughStore } from '@/stores/walkthrough.svelte.js';

	let busy = $state(false);
	let message = $state('');
	async function reset(): Promise<void> {
		busy = true;
		message = '';
		try {
			await walkthroughStore.resetFeatureTours();
			message =
				'Reset. Empty-state help links and first-use tour invitations are available again.';
		} catch {
			message = 'Could not reset feature tours. Please try again.';
		} finally {
			busy = false;
		}
	}
</script>

<div>
	<SyButton disabled={busy || walkthroughStore.exampleBusy} onclick={reset}>
		{busy ? 'Resetting…' : 'Reset feature tours'}
	</SyButton>
	<p role="status">
		{message || 'Clear progress for all feature tours and show first-use invitations again.'}
	</p>
</div>

<style>
	p {
		font-size: var(--sy-font-size--small);
		line-height: var(--sy-line-height--body);
		margin: var(--sy-space) 0 0;
	}
</style>
