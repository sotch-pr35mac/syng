<script lang="ts">
	import LoadingScreen from '@/components/LoadingScreen/LoadingScreen.svelte';
	import { databaseMigrationStore, MIGRATION_STATUS } from '@/stores/databaseMigration.svelte.js';

	const migrationFailed = $derived(databaseMigrationStore.status === MIGRATION_STATUS.FAILED);
</script>

<LoadingScreen
	testId="database-migration-screen"
	status={migrationFailed ? 'error' : 'loading'}
	title={migrationFailed ? 'Bookmarks couldn’t be updated.' : databaseMigrationStore.title}
	detail={migrationFailed ? databaseMigrationStore.errorMessage : databaseMigrationStore.detail}
	secondaryDetail={migrationFailed
		? 'Your bookmark lists and notes are safe. Quit and reopen Syng to try again.'
		: undefined}
	actionLabel={databaseMigrationStore.isPreview ? 'Close preview' : undefined}
	onaction={databaseMigrationStore.isPreview
		? () => databaseMigrationStore.closePreview()
		: undefined}
/>
