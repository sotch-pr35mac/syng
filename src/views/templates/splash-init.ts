// Reveal the native-to-WebView bridge while the document is still parsing, before the deferred
// application module can mount. The OS plugin's platform() helper reads this same Tauri-injected
// value synchronously.
(() => {
	const splash = document.getElementById('mobile-splash');
	const tauriWindow = window as Window & {
		__TAURI_OS_PLUGIN_INTERNALS__?: { platform?: string };
	};
	const platform = tauriWindow.__TAURI_OS_PLUGIN_INTERNALS__?.platform;

	if (splash && (platform === 'ios' || platform === 'android')) {
		splash.hidden = false;
		splash.setAttribute('aria-hidden', 'false');
	}
})();

export {};
