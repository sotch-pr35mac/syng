/*
 * File: migrationManager.js
 * Description: Handles file-based data migration across app identity and Tauri storage changes.
 *
 * Strategy:
 * - Export all PouchDB data to a JSON file in the app data directory.
 * - On startup, restore from the legacy org.syng.app file when the new data stores are empty.
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
const SOURCE_ATTACHMENT_ID = 'source';
const SOURCE_HTML_ATTACHMENT_ID = 'source-html';
const READER_ASSET_PREFIX = 'assets/';
const BASE64_CHUNK_SIZE = 0x8000;

function getAppDataOptions() {
	return { baseDir: BaseDirectory.AppData };
}

async function ensureAppDataDirExists() {
	try {
		await mkdir('', {
			baseDir: BaseDirectory.AppData,
			recursive: true,
		});
	} catch (e) {
		if (!e.message?.includes('already exists') && !e.message?.includes('os error 17')) {
			console.warn('Could not create app data directory:', e);
		}
	}
}

const cloneDocument = (doc) => JSON.parse(JSON.stringify(doc));

const readRows = (rows) =>
	rows
		.map((row) => row.doc)
		.filter(Boolean)
		.map(cloneDocument);

const toUint8Array = async (value) => {
	if (value instanceof Uint8Array) {
		const copy = new Uint8Array(value.byteLength);
		copy.set(value);
		return copy;
	}
	if (value instanceof ArrayBuffer) {
		return new Uint8Array(value.slice(0));
	}
	if (typeof value === 'string') {
		return new TextEncoder().encode(value);
	}
	if (typeof value?.arrayBuffer === 'function') {
		return new Uint8Array(await value.arrayBuffer());
	}
	return new Uint8Array();
};

const uint8ArrayToBase64 = (bytes) => {
	let binary = '';
	for (let index = 0; index < bytes.length; index += BASE64_CHUNK_SIZE) {
		const chunk = bytes.slice(index, index + BASE64_CHUNK_SIZE);
		binary += String.fromCharCode(...chunk);
	}
	return btoa(binary);
};

const base64ToUint8Array = (base64) => {
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let index = 0; index < binary.length; index += 1) {
		bytes[index] = binary.charCodeAt(index);
	}
	return bytes;
};

const inferAttachmentContentType = (name, metadata) => {
	if (metadata?.content_type) {
		return metadata.content_type;
	}
	if (name === SOURCE_HTML_ATTACHMENT_ID) {
		return 'text/html';
	}
	return 'application/octet-stream';
};

const collectReaderAssetAttachmentNames = (doc) => {
	const names = new Set(Object.keys(doc._attachments ?? {}));

	if (doc.source_byte_length || doc.source_sha256) {
		names.add(SOURCE_ATTACHMENT_ID);
	}
	if (doc.source_type === 'webpage') {
		names.add(SOURCE_HTML_ATTACHMENT_ID);
	}
	for (const block of doc.blocks ?? []) {
		const assetId = block.extensions?.image?.asset_id;
		if (assetId) {
			names.add(`${READER_ASSET_PREFIX}${assetId}`);
		}
	}

	return [...names].filter(
		(name) =>
			name === SOURCE_ATTACHMENT_ID ||
			name === SOURCE_HTML_ATTACHMENT_ID ||
			name.startsWith(READER_ASSET_PREFIX)
	);
};

const serializeAttachment = async (db, doc, name) => {
	const attachment = await db.getAttachment(doc._id, name);
	const bytes = await toUint8Array(attachment);
	return {
		name,
		contentType: inferAttachmentContentType(name, doc._attachments?.[name]),
		data: uint8ArrayToBase64(bytes),
	};
};

const exportReaderDocuments = async (readerDocumentManager) => {
	if (!readerDocumentManager) {
		return [];
	}

	await readerDocumentManager.waitForInit();
	const readerData = await readerDocumentManager._document_db.allDocs({ include_docs: true });
	const entries = [];

	for (const row of readerData.rows) {
		if (!row.doc) {
			continue;
		}

		const doc = cloneDocument(row.doc);
		const attachments = [];
		for (const attachmentName of collectReaderAssetAttachmentNames(doc)) {
			try {
				attachments.push(
					await serializeAttachment(
						readerDocumentManager._document_db,
						doc,
						attachmentName
					)
				);
			} catch (e) {
				console.warn('Error exporting reader attachment:', doc._id, attachmentName, e);
			}
		}
		entries.push({ doc, attachments });
	}

	return entries;
};

export async function exportMigrationData(
	preferenceManager,
	bookmarkManager,
	readerDocumentManager
) {
	await preferenceManager.waitForInit();
	await bookmarkManager.waitForInit();

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
			readerDocuments: await exportReaderDocuments(readerDocumentManager),
		},
	};

	await ensureAppDataDirExists();
	await writeTextFile(
		MIGRATION_FILE_NAME,
		JSON.stringify(migrationData, null, 2),
		getAppDataOptions()
	);

	const appDataDirPath = await appDataDir();
	console.log(`Migration data exported successfully to ${appDataDirPath}${MIGRATION_FILE_NAME}`);
}

export async function isDatabaseEmpty(bookmarkManager, readerDocumentManager) {
	await bookmarkManager.waitForInit();
	const bookmarkDocs = await bookmarkManager._document_db.allDocs();

	if (!readerDocumentManager) {
		return bookmarkDocs.rows.length === 0;
	}

	await readerDocumentManager.waitForInit();
	const readerDocs = await readerDocumentManager._document_db.allDocs({ include_docs: true });
	return bookmarkDocs.rows.length === 0 && readerDocs.rows.length === 0;
}

async function readCurrentMigrationFile() {
	try {
		return await readTextFile(MIGRATION_FILE_NAME, getAppDataOptions());
	} catch {
		return null;
	}
}

async function readLegacyMigrationFile() {
	try {
		return await invoke(NATIVE_COMMANDS.MIGRATION.READ_LEGACY_MIGRATION_FILE);
	} catch (e) {
		console.warn('Could not read legacy migration file:', e);
		return null;
	}
}

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

async function migrationComplete() {
	try {
		await readTextFile(MIGRATION_COMPLETION_FILE_NAME, getAppDataOptions());
		return true;
	} catch {
		return false;
	}
}

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

export async function migrationFileExists() {
	return Boolean(await readMigrationFileForRestore());
}

const upsertDocument = async (db, doc, options = {}) => {
	if (!doc?._id) {
		return null;
	}

	const nextDoc = cloneDocument(doc);
	if (options.removeAttachments) {
		delete nextDoc._attachments;
	}

	const existing = await db.get(nextDoc._id).catch(() => null);
	if (existing) {
		nextDoc._rev = existing._rev;
	} else {
		delete nextDoc._rev;
	}

	return db.put(nextDoc);
};

const importDocuments = async (db, docs, label) => {
	for (const doc of docs ?? []) {
		try {
			await upsertDocument(db, doc);
		} catch (e) {
			console.warn(`Error importing ${label} doc:`, doc?._id, e);
		}
	}
};

const importWordLists = async (bookmarkManager, wordLists) => {
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

const serializedAttachmentToBlob = (attachment) =>
	new Blob([base64ToUint8Array(attachment.data)], {
		type: attachment.contentType ?? attachment.type ?? 'application/octet-stream',
	});

const importReaderDocuments = async (readerDocumentManager, readerDocuments) => {
	if (!readerDocumentManager) {
		return;
	}

	for (const entry of readerDocuments ?? []) {
		const doc = entry.doc ?? entry;
		try {
			const putResult = await upsertDocument(readerDocumentManager._document_db, doc, {
				removeAttachments: true,
			});
			if (!putResult) {
				continue;
			}

			let revision = putResult.rev;
			for (const attachment of entry.attachments ?? []) {
				const attachmentResult = await readerDocumentManager._document_db.putAttachment(
					doc._id,
					attachment.name,
					revision,
					serializedAttachmentToBlob(attachment),
					attachment.contentType ?? attachment.type ?? 'application/octet-stream'
				);
				revision = attachmentResult.rev;
			}
		} catch (e) {
			console.warn('Error importing reader document:', doc?._id, e);
		}
	}
};

export async function importMigrationData(
	preferenceManager,
	bookmarkManager,
	readerDocumentManager,
	fileContent
) {
	const rawFileContent = fileContent ?? (await readCurrentMigrationFile());
	if (!rawFileContent) {
		throw new Error('No migration file available to import.');
	}

	const migrationData = JSON.parse(rawFileContent);
	const databases = migrationData.databases ?? {};

	console.log(
		`Importing migration data (version ${migrationData.version}) from ${migrationData.exportedAt}`
	);

	await importDocuments(preferenceManager._db, databases.config, 'config');
	await importWordLists(bookmarkManager, databases.wordLists);
	await importDocuments(bookmarkManager._document_db, databases.bookmarks, 'bookmark');
	await importReaderDocuments(readerDocumentManager, databases.readerDocuments);

	await preferenceManager.init();
	await bookmarkManager.init();
	if (readerDocumentManager) {
		await readerDocumentManager.init();
	}

	console.log('Migration data imported successfully');
}

export async function checkAndPerformMigration(
	preferenceManager,
	bookmarkManager,
	readerDocumentManager
) {
	const isComplete = await migrationComplete();
	const isEmpty = await isDatabaseEmpty(bookmarkManager, readerDocumentManager);
	const migrationFile = isComplete ? null : await readMigrationFileForRestore();

	console.log(
		`Migration check: database empty = ${isEmpty}, migration complete = ${isComplete}, migration file exists = ${Boolean(migrationFile)}`
	);

	if (isEmpty && migrationFile) {
		console.log(`Performing migration from ${migrationFile.source} backup file...`);
		await importMigrationData(
			preferenceManager,
			bookmarkManager,
			readerDocumentManager,
			migrationFile.contents
		);
		await markMigrationComplete(migrationFile.source);
		return true;
	}

	return false;
}

export async function setupShutdownHook(preferenceManager, bookmarkManager, readerDocumentManager) {
	await getCurrentWebviewWindow().onCloseRequested((event) => {
		if (platform() === 'macos') {
			event.preventDefault();
		}

		void (async () => {
			console.log('App closing, exporting migration data...');
			try {
				await exportMigrationData(
					preferenceManager,
					bookmarkManager,
					readerDocumentManager
				);
			} catch (e) {
				handleError('Error exporting migration data on shutdown.', e, { silent: true });
			}
		})();
	});
	console.log('Shutdown hook registered for migration data export');
}
