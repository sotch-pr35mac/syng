/*
 * Description: Will run these commands at UI-load. Assume that the user already has access to the
 * UI at this point. Therefore, these actions should be quick to complete, if an action is mission
 * critical it should have fatal error handling, and where the results of these actions are used
 * throughout the application, checks and fallbacks should be in place in case the user requests
 * something from an action that hasn't completed yet.
 */
import elasticScroll from 'elastic-scroll-polyfill';
import { BookmarkManager } from './bookmarkManager.js';
import { handleError } from './error.js';
import {
	checkAndPerformMigration,
	exportMigrationData,
	setupShutdownHook
} from './migrationManager.js';
import { PreferenceManager } from './preferenceManager.js';
import { inDebugMode } from './process.js';
import { invoke } from '@tauri-apps/api/core';
import { platform } from '@tauri-apps/plugin-os';

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
	window.preferenceManager = new PreferenceManager(configDb);
	window.bookmarkManager = new BookmarkManager(listDb, bookmarkDb);

	const startupActions = [
		{
			name: 'init-dictionary',
			action: invoke('init_dictionary'),
		},
		{
			name: 'init-preference-manager',
			action: window.preferenceManager.init(),
		},
		{
			name: 'cache-platform',
			action: () => Promise.resolve(platform()),
		},
		{
			name: 'init-bookmark-manager',
			action: window.bookmarkManager.init(),
		},
	];
	const parseStartupResults = (results) => {
		return results.map((result, index) => {
			return {
				name: startupActions[index].name,
				result: result,
			};
		});
	};
	const findResultByName = (name, results) => {
		const found = results.find((item) => item.name === name);
		return found ? found.result : undefined;
	};

	const initializeStyles = () => {
		const colorSettings = window.preferenceManager.get('toneColors');
		if (colorSettings.hasCustomColors) {
			const globalStyles = document.querySelector(':root').style;
			const toneColors = colorSettings.colors;
			for (let i = 0; i < toneColors.length; i++) {
				globalStyles.setProperty(`--sy-tone-color--${i + 1}`, toneColors[i]);
			}
		}
	};

	Promise.all(startupActions.map(item => item.action)).then(async res => {
		const results = parseStartupResults(res);
		window.platform = findResultByName('cache-platform', results);

		// Migration: Check if we need to restore from a backup file
		// This handles the Tauri 1 -> Tauri 2 upgrade scenario where IndexedDB is wiped
		try {
			await checkAndPerformMigration(
				window.preferenceManager,
				window.bookmarkManager
			);
		} catch (e) {
			console.error('Migration check failed:', e);
			// Non-fatal: continue with fresh/existing data
		}

		// Migration: Setup shutdown hook to save data when app closes
		// This ensures fresh data is available for future migrations
		setupShutdownHook(window.preferenceManager, window.bookmarkManager);

		// Migration: Also export a backup on startup as a safety net
		// In case the app crashes before a clean shutdown
		try {
			await exportMigrationData(window.preferenceManager, window.bookmarkManager);
		} catch (e) {
			console.error('Startup backup export failed:', e);
			// Non-fatal: shutdown hook will try again
		}

		document.dispatchEvent(new Event('init'));
		initializeStyles();
		return undefined;
	}).catch(e => {
		handleError('There was an error starting Syng. Please quit and try again. If this problem persists please file a bug report.', e);
	});
};
