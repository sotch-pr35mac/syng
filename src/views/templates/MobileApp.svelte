<script lang="ts">
	import { onMount } from 'svelte';
	import Router, { router } from 'svelte-spa-router';
	import MobileNavigation from '@/components/Navigation/MobileNavigation.svelte';
	import MobileSearch from '@/routes/mobile/MobileSearch.svelte';
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
	import { startLifecycleDiagnostics } from '@/utils/appLifecycle.js';
	import { databaseMigrationStore } from '@/stores/databaseMigration.svelte.js';
	import { privacySettingsStore } from '@/stores/privacySettings.svelte.js';

	runStartupActions();

	let keyboardInset = $state(0);
	let onboardingReady = $state(false);
	let startupFailed = $state(false);

	const routes = {
		'/': MobileSearch,
		'/read': lazyRoute(() => import('@/routes/mobile/Reader/MobileReader.svelte')),
		'/read/document/:id': lazyRoute(
			() => import('@/routes/mobile/Reader/MobileReaderDocument.svelte')
		),
		'/bookmarks': lazyRoute(() => import('@/routes/mobile/MobileBookmarks.svelte')),
		'/study': lazyRoute(() => import('@/routes/mobile/MobileStudy.svelte')),
		'/study/flashcards': lazyRoute(
			() => import('@/routes/mobile/Study/MobileStudyFlashcards.svelte')
		),
		'/study/quiz': lazyRoute(() => import('@/routes/mobile/Study/MobileStudyQuiz.svelte')),
		'/tools': lazyRoute(() => import('@/routes/mobile/MobileTools.svelte')),
		'/settings': lazyRoute(() => import('@/routes/mobile/MobileSettings.svelte')),
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
		'/settings': 'settings',
		'/characters': 'characters',
	};

	// The shell is pinned to the full webview via CSS (inset:0) so it can never under-fill
	// the screen even if visualViewport reports a stale/short height at rest. The keyboard
	// inset — computed from the visual viewport — is the only thing that shrinks the visible
	// content area, and only while the software keyboard is shown. window.innerHeight (the
	// layout viewport) is the stable full-height basis: it does NOT shrink with the iOS
	// keyboard, whereas visualViewport.height does.
	function computeKeyboardInset(): number {
		const viewport = window.visualViewport;
		if (!viewport) {
			return 0;
		}
		// Keyboard hidden: (height + offsetTop) ≈ innerHeight → 0. Shown: ≈ keyboard height.
		return Math.max(0, window.innerHeight - (viewport.height + viewport.offsetTop));
	}

	$effect(() => {
		if (!onboardingReady || !privacySettingsStore.hasCompletedOnboarding) {
			return;
		}
		const screenName = getRouteScreenName(router.location, routeScreenNames);
		if (screenName) {
			telemetry.trackScreen(screenName).catch(() => {});
		}
	});

	onMount(() => {
		waitForOnboardingReady()
			.then(() => {
				onboardingReady = true;
				return undefined;
			})
			.catch(() => {
				startupFailed = true;
			});

		waitForStartupComplete().catch(() => {
			startupFailed = true;
		});

		// Diagnostics for the resume-time database failure; correlates DB errors with
		// recent foreground/background transitions. No behavior change.
		const stopLifecycleDiagnostics = startLifecycleDiagnostics();
		const viewport = window.visualViewport;
		if (!viewport) {
			return stopLifecycleDiagnostics;
		}

		function update() {
			keyboardInset = computeKeyboardInset();
		}

		// Recompute on every event that can change the keyboard/viewport geometry. The first
		// visualViewport read on iOS can be stale, so also recompute after the initial frames
		// and on load/orientationchange; because the shell's base height comes from CSS
		// (inset:0), a stale read only affects the inset, which converges to 0 once a real
		// measurement lands.
		viewport.addEventListener('resize', update);
		viewport.addEventListener('scroll', update);
		window.addEventListener('orientationchange', update);
		window.addEventListener('load', update);
		const settleFrame = requestAnimationFrame(() => requestAnimationFrame(update));

		update();

		return () => {
			stopLifecycleDiagnostics();
			viewport.removeEventListener('resize', update);
			viewport.removeEventListener('scroll', update);
			window.removeEventListener('orientationchange', update);
			window.removeEventListener('load', update);
			cancelAnimationFrame(settleFrame);
		};
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
	<div class="mobile-app" style="bottom: {keyboardInset}px">
		<div class="mobile-app__content">
			{#await import('@/components/Onboarding/OnboardingFlow.svelte')}
				<LoadingScreen title="Preparing Syng…" detail="Loading setup." />
			{:then OnboardingModule}
				<OnboardingModule.default variant="mobile" />
			{:catch}
				<RouteLoadError />
			{/await}
		</div>
	</div>
{:else}
	<div class="mobile-app" style="bottom: {keyboardInset}px">
		<MobileNavigation />
		<div class="mobile-app__content">
			<Router {routes} />
		</div>
	</div>
{/if}

<style>
	.mobile-app {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		/* `bottom` is overridden inline by the keyboard inset; 0 = full webview height. */
		bottom: 0;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.mobile-app__content {
		flex: 1;
		overflow: hidden;
		position: relative;
	}
</style>
