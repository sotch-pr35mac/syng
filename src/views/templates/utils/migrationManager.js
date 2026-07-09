/*
 * File: migrationManager.js
 * Description: Handles file-based data migration across Tauri storage and app identity changes.
 *
 * When upgrading from Tauri 1 to Tauri 2, IndexedDB data can become inaccessible
 * because the WebView data directory changes. When changing the bundle identifier,
 * app-data directories also move. This module provides a file-based bridge to
 * preserve the user data that existing beta builds could have written.
 *
 * Strategy:
 * - Export PouchDB data to a JSON file in the app data directory.
 * - On startup, restore from the legacy org.syng.app file when user data is empty.
 * - On shutdown and before updater installs, export fresh data as a backup.
 *
 * See MIGRATION.md for detailed documentation.
 */

import { invoke } from '@tauri-apps/api/core';
import { appDataDir } from '@tauri-apps/api/path';
import { readTextFile, writeTextFile, mkdir, BaseDirectory } from '@tauri-apps/plugin-fs';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { platform } from '@tauri-apps/plugin-os';
import { handleError } from '@/utils/error.js';
import { NATIVE_COMMANDS } from '@/types/nativeCommands.js';

const MIGRATION_FILE_NAME = 'syng-migration-data.json';
const MIGRATION_COMPLETION_FILE_NAME = 'syng-migration-complete.json';
const MIGRATION_VERSION = 2;
const LEGACY_IDENTIFIER = 'org.syng.app';
const CURRENT_IDENTIFIER = 'xyz.bytecraft.syng';

/**
 * Get the Tauri fs options for accessing the app data directory.
 * Using BaseDirectory.AppData is more reliable than manual path construction
 * and properly handles directory creation and scope permissions.
 * @returns {object} Options object with baseDir set to AppData
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
		// Create the app data directory with recursive option.
		// Using empty string as path creates the base AppData directory itself.
		await mkdir('', {
			baseDir: BaseDirectory.AppData,
			recursive: true,
		});
	} catch (e) {
		// Directory may already exist, which is fine.
		if (!e.message?.includes('already exists') && !e.message?.includes('os error 17')) {
			console.warn('Could not create app data directory:', e);
		}
	}
}

/**
 * Deep-copy a PouchDB document before serializing or mutating it for import.
 * @param {object} doc - The document to clone.
 * @returns {object} A detached copy of the document.
 */
const cloneDocument = (doc) => JSON.parse(JSON.stringify(doc));

/**
 * Extract cloned documents from PouchDB allDocs rows.
 * @param {Array<{doc?: object}>} rows - Rows returned by allDocs({ include_docs: true }).
 * @returns {Array<object>} Documents safe to write into the migration file.
 */
const readRows = (rows) =>
	rows
		.map((row) => row.doc)
		.filter(Boolean)
		.map(cloneDocument);

/**
 * Export all PouchDB data supported by the beta migration bridge.
 * Called on startup (safety backup), shutdown (fresh backup), and before updater installs.
 * @param {PreferenceManager} preferenceManager - The preference manager instance.
 * @param {BookmarkManager} bookmarkManager - The bookmark manager instance.
 * @returns {Promise<void>}
 */
export async function exportMigrationData(preferenceManager, bookmarkManager) {
	// Wait for managers to be initialized.
	await preferenceManager.waitForInit();
	await bookmarkManager.waitForInit();

	// Gather all data from the three databases present in legacy beta builds.
	const configData = await preferenceManager._db.allDocs({ include_docs: true });
	const listData = await bookmarkManager._list_db.allDocs({ include_docs: true });
	const bookmarkData = await bookmarkManager._document_db.allDocs({ include_docs: true });

	const migrationData = {
		version: MIGRATION_VERSION,
		exportedAt: new Date().toISOString(),
		identifiers: {
			current: CURRENT_IDENTIFIER,
			legacy: LEGACY_IDENTIFIER,
		},
		databases: {
			config: readRows(configData.rows),
			wordLists: readRows(listData.rows),
			bookmarks: readRows(bookmarkData.rows),
		},
	};

	// Ensure the app data directory exists.
	await ensureAppDataDirExists();

	// Write the migration file using BaseDirectory.AppData.
	await writeTextFile(
		MIGRATION_FILE_NAME,
		JSON.stringify(migrationData, null, 2),
		getAppDataOptions()
	);

	// Log the full path for debugging.
	const appDataDirPath = await appDataDir();
	console.log(`Migration data exported successfully to ${appDataDirPath}${MIGRATION_FILE_NAME}`);
}

/**
 * Check if the current databases are empty (fresh install or post-storage migration).
 * We consider the database "empty" if there are no user bookmarks, since:
 * - config always has 1 default doc after init
 * - word-lists always has the default "Bookmarks" list after init
 * - bookmarks (actual migrated beta user data) being empty indicates no user data
 * @param {BookmarkManager} bookmarkManager - The bookmark manager instance.
 * @returns {Promise<boolean>} True if user data is empty.
 */
export async function isDatabaseEmpty(bookmarkManager) {
	await bookmarkManager.waitForInit();
	const bookmarkDocs = await bookmarkManager._document_db.allDocs();
	return bookmarkDocs.rows.length === 0;
}

/**
 * Read the current identifier's migration file, if available.
 * @returns {Promise<string|null>} File contents, or null when the file is missing/unreadable.
 */
async function readCurrentMigrationFile() {
	try {
		return await readTextFile(MIGRATION_FILE_NAME, getAppDataOptions());
	} catch {
		return null;
	}
}

/**
 * Ask native code to read the legacy identifier's migration file, if available.
 * JS fs permissions are scoped to the current identifier, so sibling app-data
 * access is handled by the Tauri command.
 * @returns {Promise<string|null>} File contents, or null when the file is missing/unreadable.
 */
async function readLegacyMigrationFile() {
	try {
		return await invoke(NATIVE_COMMANDS.MIGRATION.READ_LEGACY_MIGRATION_FILE);
	} catch (e) {
		console.warn('Could not read legacy migration file:', e);
		return null;
	}
}

/**
 * Select the best migration file to restore.
 * Legacy identifier data wins because it is the data strand that would otherwise
 * be hidden after the bundle identifier changes.
 * @returns {Promise<{contents: string, source: string}|null>} Restore candidate and source id.
 */
async function readMigrationFileForRestore() {
	const legacyFile = await readLegacyMigrationFile();
	if (legacyFile) {
		return { contents: legacyFile, source: LEGACY_IDENTIFIER };
	}

	const currentFile = await readCurrentMigrationFile();
	if (currentFile) {
		return { contents: currentFile, source: CURRENT_IDENTIFIER };
	}

	return null;
}

/**
 * Check whether this current app-data directory already completed migration.
 * @returns {Promise<boolean>} True when the completion marker exists.
 */
async function migrationComplete() {
	try {
		await readTextFile(MIGRATION_COMPLETION_FILE_NAME, getAppDataOptions());
		return true;
	} catch {
		return false;
	}
}

/**
 * Write a completion marker so prefs-only migrations do not replay on every launch.
 * @param {string} source - Identifier the restored migration file came from.
 * @returns {Promise<void>}
 */
async function markMigrationComplete(source) {
	await ensureAppDataDirExists();
	await writeTextFile(
		MIGRATION_COMPLETION_FILE_NAME,
		JSON.stringify(
			{
				version: MIGRATION_VERSION,
				completedAt: new Date().toISOString(),
				source,
			},
			null,
			2
		),
		getAppDataOptions()
	);
}

/**
 * Check if a migration file exists and is readable.
 * @returns {Promise<boolean>} True if either legacy or current migration file exists.
 */
export async function migrationFileExists() {
	return Boolean(await readMigrationFileForRestore());
}

/**
 * Insert or update one PouchDB document while avoiding stale revision conflicts.
 * @param {object} db - PouchDB-compatible database.
 * @param {object} doc - Document from the migration file.
 * @returns {Promise<object|null>} PouchDB put result, or null for invalid docs.
 */
const upsertDocument = async (db, doc) => {
	if (!doc?._id) {
		return null;
	}

	const nextDoc = cloneDocument(doc);
	const existing = await db.get(nextDoc._id).catch(() => null);
	if (existing) {
		nextDoc._rev = existing._rev;
	} else {
		delete nextDoc._rev;
	}

	return db.put(nextDoc);
};

/**
 * Import a list of documents and continue if individual docs fail.
 * @param {object} db - PouchDB-compatible database.
 * @param {Array<object>} docs - Documents from the migration file.
 * @param {string} label - Log label for import errors.
 * @returns {Promise<void>}
 */
const importDocuments = async (db, docs, label) => {
	for (const doc of docs ?? []) {
		try {
			await upsertDocument(db, doc);
		} catch (e) {
			console.warn(`Error importing ${label} doc:`, doc?._id, e);
		}
	}
};

/**
 * Import word-list docs after removing default lists that would duplicate names.
 * @param {BookmarkManager} bookmarkManager - The bookmark manager instance.
 * @param {Array<object>} wordLists - Word-list docs from the migration file.
 * @returns {Promise<void>}
 */
const importWordLists = async (bookmarkManager, wordLists) => {
	// Remove any pre-existing list whose name matches a list we're about to restore. These
	// are init()-created defaults (migration only runs when the bookmarks DB is empty, so they
	// hold no words). Restoring under the migrated _ids without this would leave two lists of
	// the same name, which breaks name-keyed UI such as the bookmark dropdowns. init()'s
	// reconcile is the safety net; this stops the duplicate from being created in the first place.
	const restoredListNames = new Set((wordLists ?? []).map((doc) => doc.name));
	const currentLists = await bookmarkManager._list_db.allDocs({ include_docs: true });
	for (const row of currentLists.rows) {
		if (row.doc && restoredListNames.has(row.doc.name)) {
			try {
				await bookmarkManager._list_db.remove(row.doc);
			} catch (e) {
				console.warn('Error removing pre-existing list before restore:', row.doc.name, e);
			}
		}
	}

	await importDocuments(bookmarkManager._list_db, wordLists, 'word list');
};

/**
 * Import data from a migration file into PouchDB databases.
 * Handles conflicts by updating existing documents with the migrated data.
 * @param {PreferenceManager} preferenceManager - The preference manager instance.
 * @param {BookmarkManager} bookmarkManager - The bookmark manager instance.
 * @param {string} [fileContent] - Optional already-read migration file content.
 * @returns {Promise<void>}
 */
export async function importMigrationData(preferenceManager, bookmarkManager, fileContent) {
	const rawFileContent = fileContent ?? (await readCurrentMigrationFile());
	if (!rawFileContent) {
		throw new Error('No migration file available to import.');
	}

	const migrationData = JSON.parse(rawFileContent);
	const databases = migrationData.databases ?? {};

	console.log(
		`Importing migration data (version ${migrationData.version}) from ${migrationData.exportedAt}`
	);

	// Import the three databases present in the Tauri 1/Tauri 2 beta migration files.
	await importDocuments(preferenceManager._db, databases.config, 'config');
	await importWordLists(bookmarkManager, databases.wordLists);
	await importDocuments(bookmarkManager._document_db, databases.bookmarks, 'bookmark');

	// Refresh the managers' internal caches with the imported data.
	await preferenceManager.init();
	await bookmarkManager.init();

	console.log('Migration data imported successfully');
}

/**
 * Perform the migration check and restore if needed.
 * Should be called after managers are initialized but before the app is fully ready.
 * @param {PreferenceManager} preferenceManager - The preference manager instance.
 * @param {BookmarkManager} bookmarkManager - The bookmark manager instance.
 * @returns {Promise<boolean>} True if migration was performed.
 */
export async function checkAndPerformMigration(preferenceManager, bookmarkManager) {
	const isComplete = await migrationComplete();
	const isEmpty = await isDatabaseEmpty(bookmarkManager);
	const migrationFile = isComplete ? null : await readMigrationFileForRestore();

	console.log(
		`Migration check: database empty = ${isEmpty}, migration complete = ${isComplete}, migration file exists = ${Boolean(migrationFile)}`
	);

	if (isEmpty && migrationFile) {
		console.log(`Performing migration from ${migrationFile.source} backup file...`);
		await importMigrationData(preferenceManager, bookmarkManager, migrationFile.contents);
		await markMigrationComplete(migrationFile.source);
		return true;
	}

	return false;
}

/**
 * Setup the shutdown hook to export data before the app closes.
 * This ensures the most up-to-date data is saved for potential future migration.
 *
 * On macOS, the Rust CloseRequested handler calls prevent_close() + hide() to keep
 * the window alive in the dock. However, because a JS listener is registered here,
 * Tauri also emits tauri://close-requested to JS. We must call event.preventDefault()
 * on macOS to stop onCloseRequested from calling destroy() after this handler,
 * which would force-destroy the window and break the dock reopen flow.
 *
 * Tauri's `onCloseRequested` implementation awaits the handler, then calls
 * `destroy()` only if `preventDefault()` was not set. An `async` handler still
 * runs its synchronous code before the first `await`, so `preventDefault()` at
 * the top of an async function would work in theory; we use a non-async handler
 * anyway so the intent is obvious and `preventDefault()` cannot accidentally
 * move below a future `await` during edits.
 *
 * We also `await` listener registration so the close hook is active before the
 * user can interact with the window, and we use getCurrentWebviewWindow because
 * Tauri 2 windows are webview windows.
 *
 * @param {PreferenceManager} preferenceManager - The preference manager instance.
 * @param {BookmarkManager} bookmarkManager - The bookmark manager instance.
 */
export async function setupShutdownHook(preferenceManager, bookmarkManager) {
	await getCurrentWebviewWindow().onCloseRequested((event) => {
		if (platform() === 'macos') {
			event.preventDefault();
		}

		void (async () => {
			console.log('App closing, exporting migration data...');
			try {
				await exportMigrationData(preferenceManager, bookmarkManager);
			} catch (e) {
				handleError('Error exporting migration data on shutdown.', e, { silent: true });
			}
		})();
	});
	console.log('Shutdown hook registered for migration data export');
}
