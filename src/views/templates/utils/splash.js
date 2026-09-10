const SPLASH_ID = 'mobile-splash';

/**
 * Controls the HTML splash used to bridge the native launch screen to the mounted app shell.
 * All methods are no-ops outside the main window, where the splash element is absent.
 *
 * @param {Document} documentRoot
 */
export function createSplashController(documentRoot = document) {
	const splash = documentRoot.getElementById(SPLASH_ID);

	return {
		show() {
			if (splash) {
				splash.hidden = false;
				splash.setAttribute('aria-hidden', 'false');
			}
		},
		dismiss() {
			if (splash) {
				splash.hidden = true;
				splash.setAttribute('aria-hidden', 'true');
			}
		},
	};
}
