<script lang="ts">
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import SyModal from '@/components/SyModal/SyModal.svelte';
	import { bookmarkRecoveryStore } from '@/stores/bookmarkRecovery.svelte.js';
	import { handleError } from '@/utils/error.js';
	import { isMobile } from '@/utils/device.js';

	let saving = $state(false);
	let copying = $state(false);

	async function copyReport(): Promise<void> {
		copying = true;
		try {
			await bookmarkRecoveryStore.copy();
		} catch (error) {
			handleError('Could not copy the bookmark recovery report.', error);
		} finally {
			copying = false;
		}
	}

	async function saveReport(): Promise<void> {
		saving = true;
		try {
			await bookmarkRecoveryStore.save();
		} catch (error) {
			handleError('Could not save the bookmark recovery report.', error);
		} finally {
			saving = false;
		}
	}
</script>

<SyModal
	title="Some bookmarks need your attention"
	visible={bookmarkRecoveryStore.active}
	onclose={() => {}}
>
	{#snippet body()}
		<p>
			Some older bookmarks could not be matched to the current dictionary. Their details are
			kept safely in this recovery report; review it, then re-add any words you still need.
		</p>
		{#if isMobile()}
			<p>You can reopen saved reports in Settings under Bookmark Recovery.</p>
		{/if}
	{/snippet}
	{#snippet footer()}
		<SyButton onclick={copyReport} disabled={copying}>Copy</SyButton>
		&nbsp;
		<SyButton onclick={saveReport} disabled={saving}>Save</SyButton>
		&nbsp;
		<SyButton onclick={() => bookmarkRecoveryStore.dismiss()}>Continue</SyButton>
	{/snippet}
</SyModal>
