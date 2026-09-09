/*
 * Description: Will run these commands at UI-load. Assume that the user already has access to the
 * UI at this point. Therefore, these actions should be quick to complete, if an action is mission
 * critical it should have fatal error handling, and where the results of these actions are used
 * throughout the application, checks and fallbacks should be in place in case the user requests
 * something from an action that hasn't completed yet.
 */
import elasticScroll from 'elastic-scroll-polyfill';
import { bookmarksStore } from '@/stores/bookmarks.svelte.js';
import { readerDocumentsStore } from '@/stores/readerDocuments.svelte.js';
import { dictionaryDisplaySettingsStore } from '@/stores/dictionaryDisplaySettings.svelte.js';
import { privacySettingsStore } from '@/stores/privacySettings.svelte.js';
import { handleError } from '@/utils/error.js';
import {
	checkAndPerformMigration,
	exportMigrationData,
	setupShutdownHook,
} from '@/utils/migrationManager.js';
import { invoke } from '@tauri-apps/api/core';
import { checkForUpdate } from '@/utils/updateManager.js';
import { isMobile } from '@/utils/device.js';
import { NATIVE_COMMANDS } from '@/types/nativeCommands.js';
import { telemetry } from '@/utils/telemetry.js';
import { createAppServices } from '@/utils/appServices.js';
import { resolveIsMasBuild } from '@/composables/settings.js';
import {
	BOOKMARK_MIGRATION_COPY,
	databaseMigrationStore,
	MIGRATION_STATUS,
} from '@/stores/databaseMigration.svelte.js';

/** Pouch database names for the session, isolated by debug mode. */
export const getStartupDatabaseNames = (debugMode) => ({
	configDb: debugMode ? 'development_config' : 'config',
	listDb: debugMode ? 'development_word-lists' : 'word-lists',
	bookmarkDb: debugMode ? 'development_bookmarks' : 'bookmarks',
	readerDocumentDb: debugMode ? 'development_reader-documents' : 'reader-documents',
});

let resolvedDebugMode = false;
export const setDebugMode = (debugMode) => {
	resolvedDebugMode = debugMode;
};

let onboardingReadyPromise = null;
let startupCompletePromise = null;
const IDLE_FALLBACK_DELAY_MS = 250;

const requireStartupPromise = (promise, phase) =>
	promise ?? Promise.reject(new Error(`${phase} requested before startup began.`));

export const waitForOnboardingReady = () =>
	requireStartupPromise(onboardingReadyPromise, 'Onboarding readiness');
export const waitForStartupComplete = () =>
	requireStartupPromise(startupCompletePromise, 'Startup completion');

const scheduleIdleWork = (task) => {
	if (typeof window.requestIdleCallback === 'function') {
		window.requestIdleCallback(() => task(), { timeout: 5000 });
		return;
	}
	window.setTimeout(task, IDLE_FALLBACK_DELAY_MS);
};

export const shouldRunStartupUpdateCheck = async () => {
	// isMobile() intentionally includes iPad, even though iPad uses the desktop UI.
	if (isMobile()) {
		return false;
	}

	return !(await resolveIsMasBuild());
};

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
	// app.js resolves and stores debug mode before mounting the shell. Reading it synchronously here
	// keeps service creation ordered when the shell starts initialization. A bare inDebugMode()
	// returns a Promise (always truthy), which would incorrectly select the development databases.
	const { configDb, listDb, bookmarkDb, readerDocumentDb } =
		getStartupDatabaseNames(resolvedDebugMode);
	const { preferenceManager, bookmarkManager, readerDocumentManager } = createAppServices(
		configDb,
		listDb,
		bookmarkDb,
		readerDocumentDb
	);

	const dictionaryInit = invoke(NATIVE_COMMANDS.DICTIONARY.INIT);
	const preferenceManagerInit = preferenceManager.init();
	const bookmarkManagerInit = bookmarkManager.init();
	const readerDocumentManagerInit = readerDocumentManager.init();
	const telemetryInit = telemetry.init().catch((error) => {
		handleError('Telemetry initialization failed', error, { silent: true });
	});

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

	const loadDisplayPreferences = async () => {
		await Promise.all([
			privacySettingsStore.loadSettings(),
			dictionaryDisplaySettingsStore.loadSettings(),
		]);
		initializeStyles();
	};

	const migrationPromise = Promise.all([preferenceManagerInit, bookmarkManagerInit]).then(
		async () => {
			// Migration: Check if we need to restore from a backup file before reading preferences.
			// This handles Tauri storage changes and the org.syng.app -> xyz.bytecraft.syng identifier
			// change for data that shipped beta builds could have written.
			try {
				return await checkAndPerformMigration(preferenceManager, bookmarkManager);
			} catch (error) {
				handleError('Migration check failed', error, { silent: true });
				return false;
			}
		}
	);

	// Existing installs can show their shell as soon as the small preference record is available.
	// A genuinely incomplete install waits for the legacy migration check before showing onboarding,
	// preventing migrated users from briefly seeing the first-run flow.
	onboardingReadyPromise = preferenceManagerInit.then(async () => {
		await loadDisplayPreferences();
		if (!privacySettingsStore.hasCompletedOnboarding) {
			await migrationPromise;
			await loadDisplayPreferences();
		}
		return undefined;
	});

	startupCompletePromise = Promise.all([
		onboardingReadyPromise,
		migrationPromise,
		bookmarkManagerInit,
		dictionaryInit,
		readerDocumentManagerInit,
	]).then(async () => {
		try {
			await bookmarkManager.prepareSchema(() => {
				databaseMigrationStore.start(BOOKMARK_MIGRATION_COPY);
			});
			if (databaseMigrationStore.status === MIGRATION_STATUS.RUNNING) {
				databaseMigrationStore.finish();
			}
		} catch (error) {
			databaseMigrationStore.fail(
				'The update could not be completed. No schema version was saved.'
			);
			throw error;
		}
		return undefined;
	});

	return startupCompletePromise
		.then(() => {
			document.dispatchEvent(new Event('init'));

			// Register shutdown handling without delaying the first usable frame.
			setupShutdownHook(preferenceManager, bookmarkManager).catch((error) => {
				handleError('Failed to register the startup shutdown hook.', error, {
					silent: true,
				});
			});

			// A full bookmark backup can be expensive for established libraries. Run it once the
			// browser is idle (or shortly after first paint where requestIdleCallback is unavailable).
			scheduleIdleWork(() => {
				exportMigrationData(preferenceManager, bookmarkManager).catch((error) => {
					handleError('Startup backup export failed', error, { silent: true });
				});
			});

			telemetryInit.then(() => telemetry.trackEvent('app.started', {})).catch(() => {});

			// Populate caches after the schema is ready. Views consume these stores reactively.
			bookmarksStore.refresh().catch((error) => {
				handleError('Initial bookmarks store load failed', error, { silent: true });
			});
			readerDocumentsStore.refresh().catch((error) => {
				handleError('Initial reader document store load failed', error, {
					silent: true,
				});
			});

			// Update checks are also non-blocking; Navigation reacts when the result arrives.
			shouldRunStartupUpdateCheck()
				.then((shouldCheck) => {
					if (shouldCheck) {
						return checkForUpdate();
					}
					return undefined;
				})
				.catch((error) => {
					handleError('Startup update check failed', error, { silent: true });
				});

			return undefined;
		})
		.catch((e) => {
			handleError(
				'There was an error starting Syng. Please quit and try again. If this problem persists please file a bug report.',
				e
			);
		});
};
