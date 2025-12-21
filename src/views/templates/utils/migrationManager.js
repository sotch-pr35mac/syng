/*
 * File: migrationManager.js
 * Description: Handles data migration between Tauri major versions.
 *
 * When upgrading from Tauri 1 to Tauri 2, IndexedDB data becomes inaccessible
 * because the WebView data directory changes. This module provides a file-based
 * bridge to preserve user data across the upgrade.
 *
 * Strategy:
 * - Export all PouchDB data to a JSON file in the app data directory (stable location)
 * - On startup, check if databases are empty and migration file exists, then restore
 * - On shutdown, export fresh data as a backup
 *
 * See MIGRATION.md for detailed documentation.
 */

import { appDataDir } from '@tauri-apps/api/path';
import { readTextFile, writeTextFile, mkdir, BaseDirectory } from '@tauri-apps/plugin-fs';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';

const MIGRATION_FILE_NAME = 'syng-migration-data.json';
const MIGRATION_VERSION = 1;

/**
 * Get the Tauri fs options for accessing the app data directory.
 * Using BaseDirectory.AppData is more reliable than manual path construction
 * and properly handles directory creation and scope permissions.
 * @returns {object} Options object with dir set to AppData
 */
function getAppDataOptions() {
	return { baseDir: BaseDirectory.AppData };
}

/**
 * Ensure the app data directory exists.
 * @returns {Promise<void>}
 */
async function ensureAppDataDirExists() {
	try {
		// Create the app data directory with recursive option
		// Using empty string as path creates the base AppData directory itself
		await mkdir('', {
			baseDir: BaseDirectory.AppData,
			recursive: true,
		});
	} catch (e) {
		// Directory may already exist, which is fine
		if (!e.message?.includes('already exists') && !e.message?.includes('os error 17')) {
			console.warn('Could not create app data directory:', e);
		}
	}
}

/**
 * Export all PouchDB data to the migration file.
 * Called on both startup (safety backup) and shutdown (fresh backup).
 * @param {PreferenceManager} preferenceManager - The preference manager instance
 * @param {BookmarkManager} bookmarkManager - The bookmark manager instance
 * @returns {Promise<void>}
 */
export async function exportMigrationData(preferenceManager, bookmarkManager) {
	// Wait for managers to be initialized
	await preferenceManager.waitForInit();
	await bookmarkManager.waitForInit();

	// Gather all data from the three databases
	const configData = await preferenceManager._db.allDocs({ include_docs: true });
	const listData = await bookmarkManager._list_db.allDocs({ include_docs: true });
	const bookmarkData = await bookmarkManager._document_db.allDocs({ include_docs: true });

	const migrationData = {
		version: MIGRATION_VERSION,
		exportedAt: new Date().toISOString(),
		databases: {
			config: configData.rows.map((row) => row.doc),
			wordLists: listData.rows.map((row) => row.doc),
			bookmarks: bookmarkData.rows.map((row) => row.doc),
		},
	};

	// Ensure the app data directory exists
	await ensureAppDataDirExists();

	// Write the migration file using BaseDirectory.AppData
	await writeTextFile(
		MIGRATION_FILE_NAME,
		JSON.stringify(migrationData, null, 2),
		getAppDataOptions()
	);

	// Log the full path for debugging
	const appDataDirPath = await appDataDir();
	console.log(`Migration data exported successfully to ${appDataDirPath}${MIGRATION_FILE_NAME}`);
}

/**
 * Check if the current databases are empty (fresh install or post-Tauri-upgrade).
 * We consider the database "empty" if there are no user bookmarks, since:
 * - config always has 1 default doc after init
 * - word-lists always has the default "Bookmarks" list after init
 * - bookmarks (actual user data) being empty indicates no user data
 * @param {BookmarkManager} bookmarkManager - The bookmark manager instance
 * @returns {Promise<boolean>} True if user data is empty
 */
export async function isDatabaseEmpty(bookmarkManager) {
	await bookmarkManager.waitForInit();
	const bookmarkDocs = await bookmarkManager._document_db.allDocs();
	return bookmarkDocs.rows.length === 0;
}

/**
 * Check if a migration file exists and is readable.
 * @returns {Promise<boolean>} True if migration file exists
 */
export async function migrationFileExists() {
	try {
		await readTextFile(MIGRATION_FILE_NAME, getAppDataOptions());
		return true;
	} catch {
		return false;
	}
}

/**
 * Import data from the migration file into PouchDB databases.
 * Handles conflicts by updating existing documents with the migrated data.
 * @param {PreferenceManager} preferenceManager - The preference manager instance
 * @param {BookmarkManager} bookmarkManager - The bookmark manager instance
 * @returns {Promise<void>}
 */
export async function importMigrationData(preferenceManager, bookmarkManager) {
	const fileContent = await readTextFile(MIGRATION_FILE_NAME, getAppDataOptions());
	const migrationData = JSON.parse(fileContent);

	console.log(
		`Importing migration data (version ${migrationData.version}) from ${migrationData.exportedAt}`
	);

	// Import config documents
	for (const doc of migrationData.databases.config) {
		try {
			// Check if document already exists (from default init)
			const existing = await preferenceManager._db.get(doc._id).catch(() => null);
			if (existing) {
				// Update existing doc - need to use its current _rev
				doc._rev = existing._rev;
			} else {
				// New doc - remove stale _rev from migration file
				delete doc._rev;
			}
			await preferenceManager._db.put(doc);
		} catch (e) {
			console.warn('Error importing config doc:', doc._id, e);
		}
	}

	// Import word list documents
	for (const doc of migrationData.databases.wordLists) {
		try {
			const existing = await bookmarkManager._list_db.get(doc._id).catch(() => null);
			if (existing) {
				doc._rev = existing._rev;
			} else {
				delete doc._rev;
			}
			await bookmarkManager._list_db.put(doc);
		} catch (e) {
			console.warn('Error importing word list doc:', doc._id, e);
		}
	}

	// Import bookmark documents
	for (const doc of migrationData.databases.bookmarks) {
		try {
			const existing = await bookmarkManager._document_db.get(doc._id).catch(() => null);
			if (existing) {
				doc._rev = existing._rev;
			} else {
				delete doc._rev;
			}
			await bookmarkManager._document_db.put(doc);
		} catch (e) {
			console.warn('Error importing bookmark doc:', doc._id, e);
		}
	}

	// Refresh the managers' internal caches with the imported data
	await preferenceManager.init();
	await bookmarkManager.init();

	console.log('Migration data imported successfully');
}

/**
 * Perform the migration check and restore if needed.
 * Should be called after managers are initialized but before the app is fully ready.
 * @param {PreferenceManager} preferenceManager - The preference manager instance
 * @param {BookmarkManager} bookmarkManager - The bookmark manager instance
 * @returns {Promise<boolean>} True if migration was performed
 */
export async function checkAndPerformMigration(preferenceManager, bookmarkManager) {
	const isEmpty = await isDatabaseEmpty(bookmarkManager);
	const fileExists = await migrationFileExists();

	console.log(
		`Migration check: database empty = ${isEmpty}, migration file exists = ${fileExists}`
	);

	if (isEmpty && fileExists) {
		console.log('Performing migration from backup file...');
		await importMigrationData(preferenceManager, bookmarkManager);
		return true;
	}

	return false;
}

/**
 * Setup the shutdown hook to export data before the app closes.
 * This ensures the most up-to-date data is saved for potential future migration.
 * @param {PreferenceManager} preferenceManager - The preference manager instance
 * @param {BookmarkManager} bookmarkManager - The bookmark manager instance
 */
export function setupShutdownHook(preferenceManager, bookmarkManager) {
	listen('tauri://close-requested', async () => {
		console.log('App closing, exporting migration data...');
		try {
			await exportMigrationData(preferenceManager, bookmarkManager);
		} catch (e) {
			console.error('Error exporting migration data on shutdown:', e);
		} finally {
			// Always close the window, even if export fails
			await getCurrentWindow().close();
		}
	});
	console.log('Shutdown hook registered for migration data export');
}
