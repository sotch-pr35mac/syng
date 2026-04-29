import App from './App.svelte';
import MobileApp from './MobileApp.svelte';
import CharacterWindow from './CharacterWindow.svelte';
import { mount } from 'svelte';
import { isMobile, isIPad } from './utils/device.js';
import { handleError } from './utils/error.js';

let app;

const appContainer = document.getElementById('app');
const charactersContainer = document.getElementById('characters');
if (appContainer) {
	let useMobile = false;
	try {
		// iPads run iOS but get the desktop UI — only phones and Android tablets use mobile UI.
		useMobile = isMobile() && !isIPad();
	} catch (e) {
		handleError(
			'Failed to determine platform. Syng may not display correctly. Please restart and file a bug if this persists.',
			e
		);
	}
	app = mount(useMobile ? MobileApp : App, { target: appContainer });
} else if (charactersContainer) {
	app = mount(CharacterWindow, { target: charactersContainer });
}

export default app;
