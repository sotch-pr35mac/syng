<script>
	import Router from 'svelte-spa-router';
	import Navigation from '@/components/Navigation/Navigation.svelte';
	import SyToast from '@/components/SyToast/SyToast.svelte';
	import Bookmarks from '@/routes/Bookmarks.svelte';
	import Chat from '@/routes/Chat.svelte';
	import Help from '@/routes/Help.svelte';
	import NotFound from '@/routes/NotFound.svelte';
	import Reader from '@/routes/Reader.svelte';
	import Search from '@/routes/Search.svelte';
	import Settings from '@/routes/Settings.svelte';
	import Study from '@/routes/Study.svelte';
	import Tools from '@/routes/Tools.svelte';
	import { location } from '@/stores/router.svelte.js';
	import { runStartupActions, handleError, installPendingUpdate, telemetry } from '@/utils';
	import { updateStore } from '@/stores/update.svelte.js';
	import Flashcards from '@/routes/Study/Flashcards.svelte';
	import Quiz from '@/routes/Study/Quiz.svelte';
	import MobileCharacters from '@/routes/mobile/MobileCharacters.svelte';

	// Run the startup script
	runStartupActions();

	let showUpdateToast = $state(false);

	const buildToastMessage = () =>
		updateStore.updateVersion
			? `Syng ${updateStore.updateVersion} is available.`
			: 'A new version of Syng is available.';

	$effect(() => {
		const screenName = routeScreenNames[$location];
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

	const routes = {
		'/': Search,
		'/read': Reader,
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

	const routeScreenNames = {
		'/': 'search',
		'/read': 'reader',
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
</script>

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
