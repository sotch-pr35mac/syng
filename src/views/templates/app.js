import App from './App.svelte';
import CharacterWindow from './CharacterWindow.svelte';

let app;

const appContainer = document.getElementById('app');
const charactersContainer = document.getElementById('characters');
if (appContainer) {
	app = new App({
		target: appContainer
	});
} else if (charactersContainer) {
	app = new CharacterWindow({
		target: charactersContainer
	});
}

export default app;