<script lang="ts">
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import { bookmarkRecoveryStore } from '@/stores/bookmarkRecovery.svelte.js';
	import { handleError } from '@/utils/error.js';

	let loading = $state(false);
	let empty = $state(false);

	async function openReports(): Promise<void> {
		loading = true;
		empty = false;
		try {
			empty = !(await bookmarkRecoveryStore.openSaved());
		} catch (error) {
			handleError('Could not read the bookmark recovery report.', error);
		} finally {
			loading = false;
		}
	}
</script>

<SyButton onclick={openReports} disabled={loading}>View recovery reports</SyButton>
{#if empty}
	<p role="status">No saved recovery reports.</p>
{/if}
