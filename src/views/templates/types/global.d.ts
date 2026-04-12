// Global Window augmentations for app-wide cached state.
// Properties set by startup.js and updateManager.ts and read across components.

interface Window {
	// Update state
	updateVersion: string;
	updateReleaseNotes: string;
	updateStatusAvailable: boolean;
	updateAvailable: boolean;
	pendingUpdate: {
		version: string;
		body?: string;
		downloadAndInstall: () => Promise<void>;
	} | null;

	// App state
	version: string;
	platform: string;
	preferenceManager: any;
	bookmarkManager: any;
	__TAURI__: any;
}
