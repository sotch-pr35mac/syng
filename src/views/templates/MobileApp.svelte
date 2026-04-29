<script lang="ts">
	import { onMount } from 'svelte';
	import Router from 'svelte-spa-router';
	import { location } from 'svelte-spa-router';
	import MobileNavigation from '@/components/Navigation/MobileNavigation.svelte';
	import MobileSearch from '@/routes/mobile/MobileSearch.svelte';
	import MobileBookmarks from '@/routes/mobile/MobileBookmarks.svelte';
	import MobileStudy from '@/routes/mobile/MobileStudy.svelte';
	import MobileStudyFlashcards from '@/routes/mobile/MobileStudyFlashcards.svelte';
	import MobileStudyQuiz from '@/routes/mobile/MobileStudyQuiz.svelte';
	import MobileSettings from '@/routes/mobile/MobileSettings.svelte';
	import MobileCharacters from '@/routes/mobile/MobileCharacters.svelte';
	import NotFound from '@/routes/NotFound.svelte';
	import { runStartupActions, telemetry } from '@/utils';

	runStartupActions();

	const routes = {
		'/': MobileSearch,
		'/bookmarks': MobileBookmarks,
		'/study': MobileStudy,
		'/study/flashcards': MobileStudyFlashcards,
		'/study/quiz': MobileStudyQuiz,
		'/settings': MobileSettings,
		'/characters': MobileCharacters,
		'*': NotFound,
	};

	const routeScreenNames: Record<string, string> = {
		'/': 'search',
		'/bookmarks': 'bookmarks',
		'/study': 'study',
		'/study/flashcards': 'flashcards',
		'/study/quiz': 'quiz',
		'/settings': 'settings',
		'/characters': 'characters',
	};

	// Track the visual viewport rather than window.innerHeight so that the layout
	// correctly shrinks when the software keyboard appears on iOS/Android.
	let viewportHeight = $state(window.visualViewport?.height ?? window.innerHeight);
	// offsetTop shifts the fixed container down when the keyboard pushes the viewport up.
	let viewportOffsetTop = $state(window.visualViewport?.offsetTop ?? 0);

	$effect(() => {
		const screenName = routeScreenNames[$location];
		if (screenName) {
			telemetry.trackScreen(screenName).catch(() => {});
		}
	});

	onMount(() => {
		const viewport = window.visualViewport;
		if (!viewport) {
			return undefined;
		}

		function update() {
			viewportHeight = viewport.height;
			viewportOffsetTop = viewport.offsetTop;
		}

		viewport.addEventListener('resize', update);
		viewport.addEventListener('scroll', update);

		return () => {
			viewport.removeEventListener('resize', update);
			viewport.removeEventListener('scroll', update);
		};
	});
</script>

<div class="mobile-app" style="height: {viewportHeight}px; top: {viewportOffsetTop}px">
	<MobileNavigation />
	<div class="mobile-app__content">
		<Router {routes} />
	</div>
</div>

<style>
	.mobile-app {
		position: fixed;
		left: 0;
		right: 0;
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
