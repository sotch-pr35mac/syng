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
	
	const routes = {
		'/': Search,
		'/search': Search,
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

<div>
	<Navigation/>

	<Router {routes}/>
</div>
