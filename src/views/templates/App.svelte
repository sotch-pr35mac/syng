<script>
	import { onMount } from 'svelte';
	import Router from 'svelte-spa-router';
	import Navigation from './components/Navigation/Navigation.svelte';
	import SyToast from './components/SyToast/SyToast.svelte';
	import Bookmarks from './routes/Bookmarks.svelte';
	import Chat from './routes/Chat.svelte';
	import Help from './routes/Help.svelte';
	import NotFound from './routes/NotFound.svelte';
	import Reader from './routes/Reader.svelte';
	import Search from './routes/Search.svelte';
	import Settings from './routes/Settings.svelte';
	import Study from './routes/Study.svelte';
	import Tools from './routes/Tools.svelte';
	import { runStartupActions, handleError, installPendingUpdate } from './utils';
	import Flashcards from './routes/Study/Flashcards.svelte';
	import Quiz from './routes/Study/Quiz.svelte';

	// Run the startup script
	runStartupActions();

	let showUpdateToast = $state(false);
	let toastMessage = $state('A new version of Syng is available.');

	const buildToastMessage = () =>
		window.updateVersion ? `Syng ${window.updateVersion} is available.` : 'A new version of Syng is available.';

	onMount(() => {
		// Seed from window in case the startup update check already finished before mount
		if (window.updateStatusAvailable && window.updateAvailable) {
			toastMessage = buildToastMessage();
			showUpdateToast = true;
		}

		const onUpdateCheckComplete = (e) => {
			if (e.detail.updateAvailable) {
				toastMessage = buildToastMessage();
				showUpdateToast = true;
			}
		};
		document.addEventListener('update-check-complete', onUpdateCheckComplete);

		return () => {
			document.removeEventListener('update-check-complete', onUpdateCheckComplete);
		};
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
		'*': NotFound,
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
	message={toastMessage}
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
