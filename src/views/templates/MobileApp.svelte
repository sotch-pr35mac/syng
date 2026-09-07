<script lang="ts">
	import { onMount } from 'svelte';
	import Router from 'svelte-spa-router';
	import { router } from 'svelte-spa-router';
	import MobileNavigation from '@/components/Navigation/MobileNavigation.svelte';
	import MobileSearch from '@/routes/mobile/MobileSearch.svelte';
	import MobileReader from '@/routes/mobile/Reader/MobileReader.svelte';
	import MobileReaderDocument from '@/routes/mobile/Reader/MobileReaderDocument.svelte';
	import MobileBookmarks from '@/routes/mobile/MobileBookmarks.svelte';
	import MobileStudy from '@/routes/mobile/MobileStudy.svelte';
	import MobileStudyFlashcards from '@/routes/mobile/Study/MobileStudyFlashcards.svelte';
	import MobileStudyQuiz from '@/routes/mobile/Study/MobileStudyQuiz.svelte';
	import MobileSettings from '@/routes/mobile/MobileSettings.svelte';
	import MobileTools from '@/routes/mobile/MobileTools.svelte';
	import MobileCharacters from '@/routes/mobile/MobileCharacters.svelte';
	import NotFound from '@/routes/NotFound.svelte';
	import { runStartupActions, waitForStartupComplete } from '@/utils/startup.js';
	import { telemetry, getRouteScreenName } from '@/utils/telemetry.js';
	import { startLifecycleDiagnostics } from '@/utils/appLifecycle.js';
	import DatabaseMigrationScreen from '@/components/DatabaseMigrationScreen/DatabaseMigrationScreen.svelte';
	import { databaseMigrationStore } from '@/stores/databaseMigration.svelte.js';
	import { handleError } from '@/utils/error.js';
	import { privacySettingsStore } from '@/stores/privacySettings.svelte.js';
	import OnboardingFlow from '@/components/Onboarding/OnboardingFlow.svelte';

	runStartupActions();

	let keyboardInset = $state(0);
	let shellReady = $state(false);

	const routes = {
		'/': MobileSearch,
		'/read': MobileReader,
		'/read/document/:id': MobileReaderDocument,
		'/bookmarks': MobileBookmarks,
		'/study': MobileStudy,
		'/study/flashcards': MobileStudyFlashcards,
		'/study/quiz': MobileStudyQuiz,
		'/tools': MobileTools,
		'/settings': MobileSettings,
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
		if (!shellReady || !privacySettingsStore.hasCompletedOnboarding) {
			return;
		}
		const screenName = getRouteScreenName(router.location, routeScreenNames);
		if (screenName) {
			telemetry.trackScreen(screenName).catch(() => {});
		}
	});

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
{:else if !shellReady}
	<div class="mobile-app" style="bottom: {keyboardInset}px" aria-busy="true"></div>
{:else if !privacySettingsStore.hasCompletedOnboarding}
	<div class="mobile-app" style="bottom: {keyboardInset}px">
		<div class="mobile-app__content">
			<OnboardingFlow variant="mobile" />
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
