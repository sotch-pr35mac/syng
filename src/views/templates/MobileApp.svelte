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
	import { runStartupActions, telemetry, getRouteScreenName } from '@/utils';
	import { startLifecycleDiagnostics } from '@/utils/lifecycleDiagnostics.js';

	runStartupActions();

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
	let keyboardInset = $state(0);

	function computeKeyboardInset(): number {
		const viewport = window.visualViewport;
		if (!viewport) {
			return 0;
		}
		// Keyboard hidden: (height + offsetTop) ≈ innerHeight → 0. Shown: ≈ keyboard height.
		return Math.max(0, window.innerHeight - (viewport.height + viewport.offsetTop));
	}

	$effect(() => {
		const screenName = getRouteScreenName(router.location, routeScreenNames);
		if (screenName) {
			telemetry.trackScreen(screenName).catch(() => {});
		}
	});

	onMount(() => {
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

<div class="mobile-app" style="bottom: {keyboardInset}px">
	<MobileNavigation />
	<div class="mobile-app__content">
		<Router {routes} />
	</div>
</div>

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
