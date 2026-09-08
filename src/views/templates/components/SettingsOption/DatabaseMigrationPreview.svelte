<script lang="ts">
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import {
		BOOKMARK_MIGRATION_COPY,
		databaseMigrationStore,
	} from '@/stores/databaseMigration.svelte.js';

	function showPreview(): void {
		databaseMigrationStore.startPreview(BOOKMARK_MIGRATION_COPY);
	}
</script>

<SyButton size="large" onclick={showPreview}>Preview migration screen</SyButton>
