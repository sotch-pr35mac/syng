<script lang="ts">
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import SyTextInput from '@/components/SyTextInput/SyTextInput.svelte';
	import { whatsNewStore } from '@/stores/whatsNew.svelte.js';

	let previousVersion = $state('2.5.3');
	let busy = $state(false);
	let error = $state('');
	const identifier = $props.id();
	async function simulate(): Promise<void> {
		busy = true;
		error = '';
		try {
			await whatsNewStore.simulateUpdate(previousVersion.trim());
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Could not simulate the update.';
			busy = false;
		}
	}
</script>

<div class="whats-new-testing">
	<SyButton disabled={busy} onclick={() => whatsNewStore.open(true)}>Preview</SyButton>
	<label for={identifier}>Simulate an update from version</label>
	<SyTextInput
		id={identifier}
		value={previousVersion}
		oninput={(value) => (previousVersion = value)}
		disabled={busy}
	/>
	<SyButton disabled={busy} onclick={simulate}>{busy ? 'Reloading…' : 'Simulate update'}</SyButton
	>
	<p>
		Simulation resets only What’s New history and reloads Syng. Onboarding, tours, and saved
		content are kept.
	</p>
	{#if error}<p role="alert">{error}</p>{/if}
</div>

<style>
	.whats-new-testing {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--sy-space--large);
	}
	p {
		margin: 0;
		font-size: var(--sy-font-size--small);
		line-height: var(--sy-line-height--body);
	}
</style>
