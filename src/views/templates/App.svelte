<script lang="ts">
	import { onMount } from 'svelte';
	import Router, { router } from 'svelte-spa-router';
	import Navigation from '@/components/Navigation/Navigation.svelte';
	import Search from '@/routes/Search.svelte';
	import SyToast from '@/components/SyToast/SyToast.svelte';
	import DatabaseMigrationScreen from '@/components/DatabaseMigrationScreen/DatabaseMigrationScreen.svelte';
	import LoadingScreen from '@/components/LoadingScreen/LoadingScreen.svelte';
	import RouteLoadError from '@/components/RouteLoading/RouteLoadError.svelte';
	import { lazyRoute } from '@/utils/lazyRoute.js';
	import {
		runStartupActions,
		waitForOnboardingReady,
		waitForStartupComplete,
	} from '@/utils/startup.js';
	import { telemetry, getRouteScreenName } from '@/utils/telemetry.js';
	import { handleError } from '@/utils/error.js';
	import { installPendingUpdate } from '@/utils/updateManager.js';
	import { updateStore } from '@/stores/update.svelte.js';
	import { privacySettingsStore } from '@/stores/privacySettings.svelte.js';
	import { databaseMigrationStore } from '@/stores/databaseMigration.svelte.js';

	runStartupActions();

	let showUpdateToast = $state(false);
	let onboardingReady = $state(false);
	let startupFailed = $state(false);

	const routes = {
		'/': Search,
		'/read': lazyRoute(() => import('@/routes/Reader/Library.svelte')),
		'/read/document/:id': lazyRoute(() => import('@/routes/Reader/Document.svelte')),
		'/bookmarks': lazyRoute(() => import('@/routes/Bookmarks.svelte')),
		'/study': lazyRoute(() => import('@/routes/Study.svelte')),
		'/study/flashcards': lazyRoute(() => import('@/routes/Study/Flashcards.svelte')),
		'/study/quiz': lazyRoute(() => import('@/routes/Study/Quiz.svelte')),
		'/tools': lazyRoute(() => import('@/routes/Tools.svelte')),
		'/help': lazyRoute(() => import('@/routes/Help.svelte')),
		'/settings': lazyRoute(() => import('@/routes/Settings.svelte')),
		'/characters': lazyRoute(() => import('@/routes/mobile/MobileCharacters.svelte')),
		'*': lazyRoute(() => import('@/routes/NotFound.svelte')),
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
		'/characters': 'characters',
	};

	const buildToastMessage = () =>
		updateStore.updateVersion
			? `Syng ${updateStore.updateVersion} is available.`
			: 'A new version of Syng is available.';

	$effect(() => {
		if (!onboardingReady || !privacySettingsStore.hasCompletedOnboarding) {
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

	function handleUpdateAction(): void {
		installPendingUpdate().catch((error) => {
			showUpdateToast = false;
			handleError(
				'There was an error fetching the update. Please try again later. Check the log for more details.',
				error
			);
		});
	}

	onMount(() => {
		waitForOnboardingReady()
			.then(() => {
				onboardingReady = true;
				return undefined;
			})
			.catch(() => {
				startupFailed = true;
			});

		// Report late database/schema failures without holding the visible shell behind them.
		waitForStartupComplete().catch(() => {
			startupFailed = true;
		});
	});
</script>

{#if databaseMigrationStore.active}
	<DatabaseMigrationScreen />
{:else if startupFailed}
	<LoadingScreen
		status="error"
		title="Syng couldn’t start."
		detail="Please restart the app. If this keeps happening, please file a bug report."
		actionLabel="Reload Syng"
		onaction={() => window.location.reload()}
	/>
{:else if !onboardingReady}
	<LoadingScreen title="Starting Syng…" detail="Loading your preferences." />
{:else if !privacySettingsStore.hasCompletedOnboarding}
	{#await import('@/components/Onboarding/OnboardingFlow.svelte')}
		<LoadingScreen title="Preparing Syng…" detail="Loading setup." />
	{:then OnboardingModule}
		<OnboardingModule.default variant="desktop" />
	{:catch}
		<RouteLoadError />
	{/await}
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
</style>
