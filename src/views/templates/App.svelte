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
	import { runStartupActions } from './utils';

	// Run the startup script
	runStartupActions();
	
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
