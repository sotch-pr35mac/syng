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
const mobileSplash = document.getElementById('mobile-splash');

function showMobileSplash() {
	if (mobileSplash) {
		mobileSplash.hidden = false;
		mobileSplash.setAttribute('aria-hidden', 'false');
	}
}

function dismissMobileSplash() {
	if (mobileSplash) {
		mobileSplash.hidden = true;
		mobileSplash.setAttribute('aria-hidden', 'true');
	}
}

function dismissMobileSplashAfterPaint() {
	if (!mobileSplash || mobileSplash.hidden) {
		return Promise.resolve();
	}

	const requestFrame = window.requestAnimationFrame?.bind(window);
	if (!requestFrame) {
		dismissMobileSplash();
		return Promise.resolve();
	}

	return new Promise((resolve) => {
		requestFrame(() => {
			requestFrame(() => {
				dismissMobileSplash();
				resolve();
			});
		});
	});
}

async function bootstrap() {
	if (appContainer) {
		let useMobile = false;
		try {
			// iPads run iOS but get the desktop UI — only phones and Android tablets use mobile UI.
			const mobileHardware = isMobile();
			useMobile = mobileHardware && !isIPad();
			if (mobileHardware) {
				showMobileSplash();
			}
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
		const mountedApp = mount(useMobile ? MobileApp : App, { target: appContainer });
		await dismissMobileSplashAfterPaint();
		document.getElementById('syng-bootstrap-launch-screen')?.remove();
		return mountedApp;
	}
	if (charactersContainer) {
		return mount(CharacterWindow, { target: charactersContainer });
	}
	return undefined;
}

const bootstrapPromise = bootstrap().catch((error) => {
	dismissMobileSplash();
	const launchStatus = document.getElementById('syng-bootstrap-launch-status');
	launchStatus?.setAttribute('role', 'alert');
	const launchStatusTitle = document.getElementById('syng-bootstrap-launch-status-title');
	const launchStatusDetail = document.getElementById('syng-bootstrap-launch-status-detail');
	if (launchStatusTitle) {
		launchStatusTitle.textContent = 'Syng could not start.';
	}
	if (launchStatusDetail) {
		launchStatusDetail.textContent = 'Please restart the app.';
	}
	handleError('Syng could not start. Please restart the app.', error);
});

export default bootstrapPromise;
