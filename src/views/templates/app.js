import App from './App.svelte';
import CharacterWindow from './CharacterWindow.svelte';
import { mount } from 'svelte';

let app;

const appContainer = document.getElementById('app');
const charactersContainer = document.getElementById('characters');
if (appContainer) {
	app = mount(App, {
    		target: appContainer
    	});
} else if (charactersContainer) {
	app = mount(CharacterWindow, {
    		target: charactersContainer
    	});
}

export default app;