<script lang="ts">
	import { onMount } from 'svelte';
	import Router from 'svelte-spa-router';
	import Navigation from '@/components/Navigation/Navigation.svelte';
	import OnboardingFlow from '@/components/Onboarding/OnboardingFlow.svelte';
	import SyToast from '@/components/SyToast/SyToast.svelte';
	import Bookmarks from '@/routes/Bookmarks.svelte';
	import Chat from '@/routes/Chat.svelte';
	import Help from '@/routes/Help.svelte';
	import NotFound from '@/routes/NotFound.svelte';
	import ReaderLibrary from '@/routes/Reader/Library.svelte';
	import ReaderDocument from '@/routes/Reader/Document.svelte';
	import Search from '@/routes/Search.svelte';
	import Settings from '@/routes/Settings.svelte';
	import Study from '@/routes/Study.svelte';
	import Tools from '@/routes/Tools.svelte';
	import { router } from 'svelte-spa-router';
	import { runStartupActions, waitForStartupComplete } from '@/utils/startup.js';
	import { telemetry, getRouteScreenName } from '@/utils/telemetry.js';
	import { handleError } from '@/utils/error.js';
	import { installPendingUpdate } from '@/utils/updateManager.js';
	import { updateStore } from '@/stores/update.svelte.js';
	import { privacySettingsStore } from '@/stores/privacySettings.svelte.js';
	import Flashcards from '@/routes/Study/Flashcards.svelte';
	import Quiz from '@/routes/Study/Quiz.svelte';
	import MobileCharacters from '@/routes/mobile/MobileCharacters.svelte';
	import DatabaseMigrationScreen from '@/components/DatabaseMigrationScreen/DatabaseMigrationScreen.svelte';
	import { databaseMigrationStore } from '@/stores/databaseMigration.svelte.js';

	runStartupActions();

	let showUpdateToast = $state(false);
	let shellReady = $state(false);

	const routes = {
		'/': Search,
		'/read': ReaderLibrary,
		'/read/document/:id': ReaderDocument,
		'/bookmarks': Bookmarks,
		'/study': Study,
		'/study/flashcards': Flashcards,
		'/study/quiz': Quiz,
		'/tools': Tools,
		'/help': Help,
		'/settings': Settings,
		'/chat': Chat,
		'/characters': MobileCharacters,
		'*': NotFound,
	};

	const routeScreenNames: Record<string, string> = {
		'/': 'search',
		'/read': 'library',
		'/bookmarks': 'bookmarks',
		'/study': 'study',
		'/study/flashcards': 'flashcards',
		'/study/quiz': 'quiz',
		'/tools': 'tools',
		'/help': 'help',
		'/settings': 'settings',
		'/chat': 'chat',
		'/characters': 'characters',
	};

	const buildToastMessage = () =>
		updateStore.updateVersion
			? `Syng ${updateStore.updateVersion} is available.`
			: 'A new version of Syng is available.';

	$effect(() => {
		if (!shellReady || !privacySettingsStore.hasCompletedOnboarding) {
			return;
		}
		const screenName = getRouteScreenName(router.location, routeScreenNames);
		if (screenName) {
			telemetry.trackScreen(screenName).catch(() => {});
		}
	});

	$effect(() => {
		if (updateStore.knownStatus && updateStore.updateAvailable) {
			showUpdateToast = true;
		}
	});

	const handleUpdateAction = () => {
		installPendingUpdate().catch((e) => {
			showUpdateToast = false;
			handleError(
				'There was an error fetching the update. Please try again later. Check the log for more details.',
				e
			);
		});
	};

	onMount(() => {
		waitForStartupComplete()
			.then(() => {
				shellReady = true;
				return undefined;
			})
			.catch((error) => {
				handleError(
					'There was an error starting Syng. Please quit and try again. If this problem persists please file a bug report.',
					error
				);
			});
	});
</script>

{#if databaseMigrationStore.active}
	<DatabaseMigrationScreen />
{:else if !shellReady}
	<div class="app-shell-pending" aria-busy="true"></div>
{:else if !privacySettingsStore.hasCompletedOnboarding}
	<OnboardingFlow variant="desktop" />
{:else}
	<div class="app-container">
		<div class="navigation-container">
			<Navigation />
		</div>
		<div class="content-container">
			<Router {routes} />
		</div>
	</div>

	<SyToast
		visible={showUpdateToast}
		message={buildToastMessage()}
		actionLabel="Update now"
		corner="bottom-right"
		onaction={handleUpdateAction}
		ondismiss={() => (showUpdateToast = false)}
	/>
{/if}

<style>
	.app-container {
		display: flex;
		height: 100vh;
		overflow: hidden;
	}
	.navigation-container {
		display: flex;
		flex: 1;
		max-width: 93px;
		min-width: 92px;
	}
	.content-container {
		display: flex;
		flex: 11;
	}
	.app-shell-pending {
		height: 100vh;
	}
</style>
