<script>
	import Router from 'svelte-spa-router';
	import Search from './routes/Search.svelte';
	import Reader from './routes/Reader.svelte';
	import Bookmarks from './routes/Bookmarks.svelte';
	import Study from './routes/Study.svelte';
	import Tools from './routes/Tools.svelte';
	import Help from './routes/Help.svelte';
	import Settings from './routes/Settings.svelte';
	import Chat from './routes/Chat.svelte';
	import NotFound from './routes/NotFound.svelte';
	import Navigation from './components/Navigation/Navigation.svelte';
	import { handleError, PreferenceManager, inDebugMode } from './utils/';
	import elasticScroll from 'elastic-scroll-polyfill';
	// TODO: Remove this node dependency and migrate it to Tauri since native npm modules 
	// won't load in the browser
	window.dictionary = {
		init: () => new Promise((res, rej) => {
			res();
		})
	};
	const configPath = inDebugMode() ? 'Projects/syng/app/src/resources/debug_config.json' : 'config.json';
	window.preferenceManager = new PreferenceManager(configPath);
	Promise.all([
		window.dictionary.init(),
		window.preferenceManager.init()
	]).then(() => {
		document.dispatchEvent(new Event('init'));
	}).catch(e => {
		handleError('There was an error starting Syng. Please quit and try again. If this problem persists please file a bug report.', e);
	});

	const initializeStyles = () => {
		if(window.preferenceManager.initialized) {
			const colorSettings = window.preferenceManager.get('tone-colors');
			if(colorSettings.hasCustomColors) {
				const globalStyles = document.querySelector(':root').style;
				const toneColors = colorSettings.colors;
				for(let i = 0; i < toneColors.length; i++) {
					globalStyles.setProperty(`--sy-tone-color--${i+1}`, toneColors[i]);
				}
			}
		} else {
			setTimeout(initializeStyles, 10);
		}
	};
	window.onload = () => {
		elasticScroll({ appleDeviceOnly: false, intensity: 1 });
		initializeStyles();
	};
	
	const routes = {
		'/': Search,
		'/read': Reader,
		'/bookmarks': Bookmarks,
		'/study': Study,
		'/tools': Tools,
		'/help': Help,
		'/settings': Settings,
		'/chat': Chat,
		'*': NotFound
	};
</script>

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

<div class="app-container">
	<div class="navigation-container">
		<Navigation/>
	</div>
	<div class="content-container">
		<Router {routes}/>
	</div>
</div> 
