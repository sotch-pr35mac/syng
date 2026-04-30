/*
 * Description: Will run these commands at UI-load. Assume that the user already has access to the
 * UI at this point. Therefore, these actions should be quick to complete, if an action is mission
 * critical it should have fatal error handling, and where the results of these actions are used
 * throughout the application, checks and fallbacks should be in place in case the user requests
 * something from an action that hasn't completed yet.
 */
import elasticScroll from 'elastic-scroll-polyfill';
import { bookmarksStore } from '@/stores/bookmarks.svelte.js';
import { handleError } from '@/utils/error.js';
import {
	checkAndPerformMigration,
	exportMigrationData,
	setupShutdownHook,
} from '@/utils/migrationManager.js';
import { inDebugMode } from '@/utils/process.js';
import { invoke } from '@tauri-apps/api/core';
import { checkForUpdate } from '@/utils/updateManager.js';
import { isMobile } from '@/utils/device.js';
import { NATIVE_COMMANDS } from '@/types/nativeCommands.js';
import { telemetry } from '@/utils/telemetry.js';
import { createAppServices } from '@/utils/appServices.js';

// This should be run on all windows, not just the main window. Therefore
// it is run outside of the `runStartupActions` context.

// Disable right-click context menu throughout the entire app
document.addEventListener('contextmenu', (event) => {
	event.preventDefault();
	return false;
});

window.onload = () => {
	elasticScroll({ appleDevicesOnly: false, intensity: 1 });
};

// Startup actions to only be run once per application start.
export const runStartupActions = () => {
	const debugMode = inDebugMode();
	const configDb = debugMode ? 'development_config' : 'config';
	const listDb = debugMode ? 'development_word-lists' : 'word-lists';
	const bookmarkDb = debugMode ? 'development_bookmarks' : 'bookmarks';
	const { preferenceManager, bookmarkManager } = createAppServices(configDb, listDb, bookmarkDb);

	const startupActions = [
		{
			name: 'init-dictionary',
			action: invoke(NATIVE_COMMANDS.DICTIONARY.INIT),
		},
		{
			name: 'init-preference-manager',
			action: preferenceManager.init(),
		},
		{
			name: 'init-bookmark-manager',
			action: bookmarkManager.init(),
		},
		{
			name: 'init-telemetry',
			action: telemetry.init(),
		},
	];
	const initializeStyles = () => {
		const colorSettings = preferenceManager.get('toneColors');
		if (colorSettings.hasCustomColors) {
			const globalStyles = document.querySelector(':root').style;
			const toneColors = colorSettings.colors;
			for (let i = 0; i < toneColors.length; i++) {
				globalStyles.setProperty(`--sy-tone-color--${i + 1}`, toneColors[i]);
			}
		}
	};

	Promise.all(startupActions.map((item) => item.action))
		.then(async () => {
			// Migration: Check if we need to restore from a backup file
			// This handles the Tauri 1 -> Tauri 2 upgrade scenario where IndexedDB is wiped
			try {
				await checkAndPerformMigration(preferenceManager, bookmarkManager);
			} catch (error) {
				handleError('Migration check failed', error, { silent: true });
			}

			// Migration: Setup shutdown hook to save data when app closes
			// This ensures fresh data is available for future migrations
			await setupShutdownHook(preferenceManager, bookmarkManager);

			// Migration: Also export a backup on startup as a safety net
			// In case the app crashes before a clean shutdown
			try {
				await exportMigrationData(preferenceManager, bookmarkManager);
			} catch (error) {
				handleError('Startup backup export failed', error, { silent: true });
			}

			document.dispatchEvent(new Event('init'));
			initializeStyles();
			telemetry.trackEvent('app.started', {}).catch(() => {});

			// Populate the bookmarks store cache now that the manager is ready (and any
			// migration has completed). Non-blocking — views read reactive `bookmarksStore.lists`
			// and will update when this resolves.
			bookmarksStore.refresh().catch((error) => {
				handleError('Initial bookmarks store load failed', error, { silent: true });
			});

			// Non-blocking update check — results are cached to window and broadcast
			// via event so Navigation can show a badge without blocking startup.
			if (!isMobile()) {
				checkForUpdate().catch((error) => {
					handleError('Startup update check failed', error, { silent: true });
				});
			}

			return undefined;
		})
		.catch((e) => {
			handleError(
				'There was an error starting Syng. Please quit and try again. If this problem persists please file a bug report.',
				e
			);
		});
};
