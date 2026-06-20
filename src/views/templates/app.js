import App from '@/App.svelte';
import MobileApp from '@/MobileApp.svelte';
import CharacterWindow from '@/CharacterWindow.svelte';
import { mount } from 'svelte';
import { isMobile, isIPad } from '@/utils/device.js';
import { handleError } from '@/utils/error.js';
import { inDebugMode } from '@/utils/process.js';
import { setDebugMode } from '@/utils/startup.js';

const appContainer = document.getElementById('app');
const charactersContainer = document.getElementById('characters');

async function bootstrap() {
	if (appContainer) {
		let useMobile = false;
		try {
			// iPads run iOS but get the desktop UI — only phones and Android tablets use mobile UI.
			useMobile = isMobile() && !isIPad();
		} catch (error) {
			handleError(
				'Failed to determine platform. Syng may not display correctly. Please restart and file a bug if this persists.',
				error
			);
		}
		// Resolve the debug flag before mounting so the shell's synchronous runStartupActions()
		// creates the app services with the correct (production vs development_*) database names.
		// inDebugMode() never rejects (getArgs swallows errors and returns {}), so this defaults
		// to false — the production databases — on any failure.
		setDebugMode(await inDebugMode());
		return mount(useMobile ? MobileApp : App, { target: appContainer });
	}
	if (charactersContainer) {
		return mount(CharacterWindow, { target: charactersContainer });
	}
	return undefined;
}

export default bootstrap();
