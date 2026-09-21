/*
 * File: bookmarkManager.js
 * Description: Describes the bookmark manager to read and write bookmarks.
 * An instance of BookmarkManager class is created from a desired pouchdb.
 * Raw initialization is separate from schema readiness so restoration can run first.
 */
import { describeUnknownError, handleError } from '@/utils/error.js';
import { telemetry } from '@/utils/telemetry.js';
import { getResumeContext } from '@/utils/appLifecycle.js';
import { invoke } from '@tauri-apps/api/core';
import { NATIVE_COMMANDS } from '@/types/nativeCommands.js';

// Default bookmark data
const DEFAULT_BOOKMARK_DATA = {
	lists: [],
	notes: '',
};

// Which properties of a word entry that should be modifiable
// through the `updateProperty` method.
const MODIFIABLE_BOOKMARK_PROPERTIES = ['notes'];

// Symbol for early exit from promise chains
const EARLY_EXIT = Symbol('EARLY_EXIT');

export const BOOKMARK_SCHEMA_VERSION = 2;
export const BOOKMARK_SCHEMA_DOCUMENT_ID = '_local/syng-bookmark-schema';
export const BOOKMARK_RECOVERY_DOCUMENT_ID = '_local/syng-bookmark-recovery';
const NOT_FOUND_STATUS = 404;

const isLexicalId = (value) => typeof value === 'string' && /^1:[0-9a-f]{64}$/.test(value);

const joinDistinctNotes = (currentNotes, incomingNotes) => {
	const current = typeof currentNotes === 'string' ? currentNotes.trim() : '';
	const incoming = typeof incomingNotes === 'string' ? incomingNotes.trim() : '';
	if (!current) {
		return incoming;
	}
	if (!incoming || current.split('\n\n---\n\n').includes(incoming)) {
		return current;
	}
	return `${current}\n\n---\n\n${incoming}`;
};

export class BookmarkManager {
	/*
	 * Description: Construct an instance of the bookmark manager.
	 * Param: String: listDb: The name of the list database to use.
	 * Param: String: documentDb: The name of the document database to use.
	 * Return: BookmarkManager: The BookmarkManager instance.
	 */
	constructor(listDb, documentDb) {
		this.initialized = false;
		this.ready = false;
		this._resolveReady = undefined;
		this._readyPromise = new Promise((resolve) => {
			this._resolveReady = resolve;
		});
		this._list_db = new PouchDB(listDb);
		this._document_db = new PouchDB(documentDb);
	}

	_markReady() {
		if (!this.ready) {
			this.ready = true;
			this._resolveReady();
		}
	}

	/**
	 * Bring this bookmark database up to its current schema after any storage restoration.
	 * The local marker is scoped to the bookmark PouchDB and is excluded from normal allDocs
	 * reads and backups. `onMigrationStart` runs only for a populated database that needs work.
	 */
	async prepareSchema(onMigrationStart = () => {}, onRecoveryReport = () => {}) {
		await this.waitForInit();

		let marker;
		try {
			marker = await this._document_db.get(BOOKMARK_SCHEMA_DOCUMENT_ID);
		} catch (error) {
			if (error?.status !== NOT_FOUND_STATUS && error?.name !== 'not_found') {
				throw error;
			}
		}

		if (marker?.version >= BOOKMARK_SCHEMA_VERSION) {
			this._markReady();
			return false;
		}

		const documents = await this._document_db.allDocs({ limit: 1 });
		if (documents.rows.length) {
			onMigrationStart();
			await this.migrateLegacyBookmarks(onRecoveryReport);
		}

		const markerResult = await this._document_db.put({
			...(marker ?? {}),
			_id: BOOKMARK_SCHEMA_DOCUMENT_ID,
			version: BOOKMARK_SCHEMA_VERSION,
		});
		if (markerResult?.ok !== true) {
			throw new Error('Bookmark schema version could not be saved.');
		}
		this._markReady();
		return documents.rows.length > 0;
	}

	async migrateLegacyBookmarks(onRecoveryReport = () => {}) {
		const documents = await this._document_db.allDocs({ include_docs: true });
		const rows = documents.rows.map((row) => row.doc).filter(Boolean);
		const legacyRows = rows.filter((word) => !isLexicalId(word.lexical_id));
		const resolutions = legacyRows.length
			? await invoke(NATIVE_COMMANDS.DICTIONARY.RESOLVE_LEGACY_LEXICAL_UNITS, {
					entries: legacyRows.map((word) => ({
						simplified: typeof word.simplified === 'string' ? word.simplified : '',
						traditional: typeof word.traditional === 'string' ? word.traditional : '',
						pinyin_numbers:
							typeof word.pinyin_numbers === 'string'
								? word.pinyin_numbers
								: (word.pinyin?.numbers ?? ''),
						tone_marks: Array.isArray(word.tone_marks)
							? word.tone_marks
							: (word.pinyin?.tones ?? []),
						english: Array.isArray(word.english)
							? word.english.map((definition) =>
									typeof definition === 'string'
										? definition
										: (definition?.gloss?.value ?? '')
								)
							: [],
					})),
				})
			: [];
		if (!Array.isArray(resolutions) || resolutions.length !== legacyRows.length) {
			throw new Error('Bookmark conversion returned an invalid result.');
		}

		const resolutionByDocumentId = new Map(
			legacyRows.map((word, index) => [word._id, resolutions[index]])
		);
		const merged = new Map();
		const deleted = [];
		const unrecovered = [];
		for (const word of rows) {
			const resolution = resolutionByDocumentId.get(word._id);
			const lexicalId = isLexicalId(word.lexical_id) ? word.lexical_id : resolution?.unit?.id;
			if (!isLexicalId(lexicalId)) {
				unrecovered.push({
					reason: resolution?.reason ?? 'No usable lexical ID was found.',
					legacy: word,
				});
				deleted.push({ ...word, _deleted: true });
				continue;
			}
			const clean = {
				_id: word._id,
				...(word._rev ? { _rev: word._rev } : {}),
				lexical_id: lexicalId,
				lists: Array.isArray(word.lists) ? [...new Set(word.lists)] : [],
				notes: typeof word.notes === 'string' ? word.notes : '',
			};
			const previous = merged.get(lexicalId);
			if (previous) {
				previous.lists = [...new Set([...previous.lists, ...clean.lists])];
				previous.notes = joinDistinctNotes(previous.notes, clean.notes);
				deleted.push({ ...clean, _deleted: true });
			} else {
				merged.set(lexicalId, clean);
			}
		}

		if (unrecovered.length) {
			const report = [
				'Some bookmarks could not be matched to the current dictionary and were not migrated.',
				'Re-add these words manually after reviewing the legacy data below.',
				...unrecovered.map(
					(entry) =>
						`${entry.reason}\nLegacy data:\n${JSON.stringify(entry.legacy, null, 2)}`
				),
			].join('\n\n==========\n\n');
			await invoke(NATIVE_COMMANDS.BOOKMARKS.PERSIST_RECOVERY_REPORT, { report });
			const previousReport = await this._document_db
				.get(BOOKMARK_RECOVERY_DOCUMENT_ID)
				.catch((error) =>
					error?.status === NOT_FOUND_STATUS ? undefined : Promise.reject(error)
				);
			const result = await this._document_db.put({
				...(previousReport ?? {}),
				_id: BOOKMARK_RECOVERY_DOCUMENT_ID,
				report,
				created_at: new Date().toISOString(),
			});
			if (result?.ok !== true) {
				throw new Error('Bookmark recovery report could not be saved.');
			}
			onRecoveryReport(report);
		}

		const updates = [...merged.values(), ...deleted];
		if (updates.length) {
			const results = await this._document_db.bulkDocs(updates);
			if (!Array.isArray(results) || results.some((result) => result?.ok !== true)) {
				throw new Error('Bookmark migration could not persist every bookmark.');
			}
		}
	}

	/*
	 * Description: Load the bookmarks. If no bookmarks data is present initialize it.
	 * Return: Promise: Returns a Promise that resolves to undefined when the bookmarks
	 * have loaded; fatally rejects if the bookmarks cannot be loaded or created.
	 */
	async init() {
		let documents;
		try {
			// Collapse any duplicate-named lists before anything reads them. This both repairs
			// databases that already contain duplicates and self-heals the duplicate that the
			// migration importer can create, because importMigrationData calls init() again at
			// its end (see _reconcileDuplicateLists and utils/migrationManager.js).
			await this._reconcileDuplicateLists();
			documents = await this._list_db.allDocs({ include_docs: true });
		} catch (error) {
			console.error(error);
			throw new Error(
				'There was an error loading bookmarks data. Check the logs for more details.',
				{ cause: error }
			);
		}

		// Syng expects there to always be a bookmarks list. If a bookmarks list is not
		// present, initialize it.
		if (!documents.rows.some((list) => list.doc.name === 'Bookmarks')) {
			try {
				const result = await this._list_db.post({ name: 'Bookmarks' });
				if (!result.ok) {
					console.error(result);
					throw new Error('Creating the default Bookmarks list did not succeed.');
				}
			} catch (error) {
				console.error(error);
				throw new Error(
					'There was an error initializing the bookmarks data. Check the logs for more details.',
					{ cause: error }
				);
			}
		}

		this.initialized = true;
	}

	/*
	 * Description: Enforce the invariant that each list name maps to exactly one list
	 * document. Two startup paths historically created same-named lists with different
	 * _ids — init() creating a default 'Bookmarks' by name, and importMigrationData restoring
	 * the exported 'Bookmarks' by _id — producing duplicate-named lists that collide in
	 * name-keyed UI. This collapses every duplicate group onto a single canonical document,
	 * re-points word entries that referenced a removed list onto the canonical list id (and
	 * de-dupes each word's membership), then deletes the extra list documents. Idempotent:
	 * a no-op when every list name is already unique.
	 * Return: Promise: Resolves once any duplicates have been reconciled.
	 */
	async _reconcileDuplicateLists() {
		const listDocuments = await this._list_db.allDocs({ include_docs: true });

		const listsByName = new Map();
		for (const row of listDocuments.rows) {
			const existing = listsByName.get(row.doc.name);
			if (existing) {
				existing.push(row.doc);
			} else {
				listsByName.set(row.doc.name, [row.doc]);
			}
		}

		// Map each removed (duplicate) list id to the canonical id it should merge into.
		const canonicalListId = new Map();
		const listsToDelete = [];
		for (const group of listsByName.values()) {
			if (group.length < 2) {
				continue;
			}
			const [canonical, ...duplicates] = group;
			for (const duplicate of duplicates) {
				canonicalListId.set(duplicate._id, canonical._id);
				listsToDelete.push(duplicate);
			}
		}

		if (!listsToDelete.length) {
			return;
		}

		// Re-point word entries off the removed lists and onto the canonical ids, de-duping
		// each word's membership so a word that lived in both copies isn't listed twice.
		const wordDocuments = await this._document_db.allDocs({ include_docs: true });
		const wordsToUpdate = [];
		for (const row of wordDocuments.rows) {
			const word = row.doc;
			if (!Array.isArray(word.lists)) {
				continue;
			}
			const remappedLists = [];
			let changed = false;
			for (const listId of word.lists) {
				const mappedListId = canonicalListId.get(listId) ?? listId;
				if (mappedListId !== listId) {
					changed = true;
				}
				if (remappedLists.includes(mappedListId)) {
					changed = true;
				} else {
					remappedLists.push(mappedListId);
				}
			}
			if (changed) {
				word.lists = remappedLists;
				wordsToUpdate.push(word);
			}
		}

		if (wordsToUpdate.length) {
			await this._document_db.bulkDocs(wordsToUpdate);
		}
		await this._list_db.bulkDocs(listsToDelete.map((list) => ({ ...list, _deleted: true })));
	}

	/*
	 * Description: A function that resolves a promise once the database has been initialized.
	 * Should be used when data is required at application load when it is reasonable
	 * that there may be a race condition with db initialization. Internally just pools the
	 * value of `initialized` until initialization has completed.
	 * Return: Promise: Returns a promise that resolves once initialization has been completed.
	 */
	waitForInit() {
		const POLL_INTERVAL_MS = 10;
		return new Promise((resolve) => {
			const pollInit = () => {
				if (this.initialized) {
					resolve();
				} else {
					setTimeout(pollInit, POLL_INTERVAL_MS);
				}
			};
			pollInit();
		});
	}

	/**
	 * Resolve only after storage restoration and all bookmark schema migrations complete.
	 * Bookmark consumers use this gate; migration code itself uses waitForInit().
	 */
	waitForReady() {
		return this._readyPromise;
	}

	/*
	 * Description: Diagnostics-only reporter for read failures. Logs the original error
	 * and reports its name/message plus an app-resume context to telemetry, so the
	 * resume-time database failure can be correlated with a recent resume before the DB
	 * layer is changed. The caller still rejects with its existing user-facing message,
	 * so behavior is unchanged.
	 * Param: String: operation: The manager method that failed (e.g. 'inList').
	 * Param: Any: error: The original error caught from PouchDB.
	 */
	_reportDbError(operation, error) {
		console.error(error);
		telemetry
			.trackError('bookmarks.db_error', error?.message ?? 'unknown error', {
				operation,
				...describeUnknownError(error),
				...getResumeContext(),
			})
			.catch(() => {});
	}

	/*
	 * Description: Get a list of the word lists
	 * Return: Promise<Array<String>>: Returns a Promise that resolves with a list of
	 * strings representing the names of the available word lists.
	 */
	getLists() {
		return new Promise((resolve, reject) => {
			this._list_db
				.allDocs({ include_docs: true })
				.then((documents) => {
					resolve(documents.rows.map((list) => list.doc.name));
					return undefined;
				})
				.catch((e) => {
					this._reportDbError('getLists', e);
					reject(new Error('There was an error fetching the available word lists.'));
				});
		});
	}

	/*
	 * Description: Get a list of the empty lists (lists with no contents).
	 * Return: Promise<Array<String>>: Returns a Promise that resolves to a list
	 * of strings representing the names of the lists without contents.
	 */
	getEmptyLists() {
		let lists = undefined;
		return new Promise((resolve, reject) => {
			this._list_db
				.allDocs({ include_docs: true })
				.then((documents) => {
					lists = documents.rows.map((list) => list.doc);
					return this._document_db.allDocs({ include_docs: true });
				})
				.then((wordsResult) => {
					const wordDocs = wordsResult.rows.map((word) => word.doc);

					const emptyLists = lists
						.filter((list) => {
							const listId = list._id;
							const listContents = wordDocs.filter((word) =>
								word.lists.includes(listId)
							);
							return !listContents.length;
						})
						.map((list) => list.name);

					resolve(emptyLists);
					return undefined;
				})
				.catch((e) => {
					console.error(e);
					reject(new Error('There was an error trying to fetch empty lists.'));
				});
		});
	}

	/*
	 * Description: Create a new word list.
	 * Param: String: listName: The name of the list to create.
	 * Return: Promise: Resolves when the list has been successfully created.
	 * Rejects otherwise.
	 */
	createList(listName) {
		return new Promise((resolve, reject) => {
			// Get the current listing of lists
			this._list_db
				.allDocs({ include_docs: true })
				.then((documents) => {
					return documents.rows.map((list) => list.doc.name);
				})
				.then((lists) => {
					// List names should be unique
					if (lists.includes(listName)) {
						reject(
							new Error(
								`Cannot create list. A list with the name ${listName} already exists.`
							)
						);
						throw EARLY_EXIT;
					}

					// Create the new list.
					return this._list_db.post({ name: listName });
				})
				.then((result) => {
					if (result.ok) {
						resolve();
					} else {
						console.error(result);
						reject(
							new Error(
								`There was an error while creating ${listName}. Check the logs for more details.`
							)
						);
					}
					return undefined;
				})
				.catch((e) => {
					if (e === EARLY_EXIT) {
						return;
					}
					throw e;
				})
				.catch((e) => {
					console.error(e);
					reject(
						new Error(
							`There was an error while creating ${listName}. Check the logs for more details.`
						)
					);
				});
		});
	}

	/*
	 * Description: Delete a word list.
	 * Param: String: listName: The name of the list to delete. Removes the list from any word entries.
	 * If the list is the only list on a word entry, the word entry is deleted.
	 * Return: Promise: Resolves when the list has been removed and all of the affected words are
	 * updated.
	 */
	deleteList(listName) {
		let listId = undefined;
		return new Promise((resolve, reject) => {
			this._list_db
				.allDocs({ include_docs: true })
				.then((documents) => {
					const listToRemove = documents.rows.filter(
						(list) => list.doc.name === listName
					)[0];
					if (!listToRemove) {
						reject(
							new Error(
								`There was an error deleting the list ${listName}. The list does not exist.`
							)
						);
						throw EARLY_EXIT;
					}

					listToRemove.doc._deleted = true;
					listId = listToRemove.doc._id;
					return this._list_db.put(listToRemove.doc);
				})
				.then((result) => {
					if (result.ok) {
						// Now that we've removed the list, we should remove the list from all associated words
						return this._document_db.allDocs({ include_docs: true });
					} else {
						console.error(result);
						reject(
							`There was an error deleting the list ${listName}. Check the log for more details.`
						);
						throw EARLY_EXIT;
					}
				})
				.then((documents) => {
					const words = documents.rows.map((doc) => doc.doc);
					for (let i = 0; i < words.length; i++) {
						const word = words[i];
						word.lists = word.lists.filter((id) => id !== listId);
						if (!word.lists.length) {
							word._deleted = true;
						}
					}

					// Update or remove the bookmarked words
					return this._document_db.bulkDocs(words);
				})
				.then((results) => {
					if (results.map((result) => result.ok).includes(false)) {
						console.error(results);
						reject(
							new Error(
								`There was an error deleting the list ${listName}. Check the log for more details.`
							)
						);
					} else {
						resolve();
					}
					return undefined;
				})
				.catch((e) => {
					if (e === EARLY_EXIT) {
						return;
					}
					throw e;
				})
				.catch((e) => {
					console.error(e);
					reject(
						new Error(
							`There was an error deleting the list ${listName}. Check the log for more details.`
						)
					);
				});
		});
	}

	/*
	 * Description: Get the content of a word list.
	 * Param: String: listName: The name of the list to get the content of.
	 * Return: Promise<Array<Object>>: The content of the list.
	 */
	getListContent(listName) {
		let listId = undefined;
		return new Promise((resolve, reject) => {
			this._list_db
				.allDocs({ include_docs: true })
				.then((documents) => {
					const list = documents.rows.filter((list) => list.doc.name === listName)[0];
					if (!list) {
						console.error(documents);
						reject(
							new Error(
								`There was an error fetching the contents of ${listName}. List does not exist! Check the log for more details.`
							)
						);
						throw EARLY_EXIT;
					}

					listId = list.doc._id;
					return this._document_db.allDocs({ include_docs: true });
				})
				.then(async (documents) => {
					const bookmarkDocuments = documents.rows
						.map((row) => row.doc)
						.filter((word) => word?.lists?.includes(listId));
					if (bookmarkDocuments.some((word) => !isLexicalId(word.lexical_id))) {
						throw new Error('Bookmark schema preparation did not produce lexical IDs.');
					}
					const units = await invoke(NATIVE_COMMANDS.DICTIONARY.QUERY_BY_IDS, {
						ids: bookmarkDocuments.map((word) => word.lexical_id),
					});
					if (!Array.isArray(units) || units.length !== bookmarkDocuments.length) {
						throw new Error('Bookmark lookup returned an invalid result.');
					}
					resolve(
						units
							.map((unit, index) =>
								unit ? { ...bookmarkDocuments[index], ...unit } : undefined
							)
							.filter(Boolean)
					);
					return undefined;
				})
				.catch((e) => {
					if (e === EARLY_EXIT) {
						return;
					}
					throw e;
				})
				.catch((e) => {
					this._reportDbError('getListContent', e);
					reject(
						new Error(
							`There was an error loading the list ${listName}. Check the log for more details.`
						)
					);
				});
		});
	}

	/*
	 * Description: Get a word entry document by its versioned lexical ID.
	 * Param: String: lexicalId: The lexical ID of the word entry to get.
	 * Return: Promise<Object>: The word entry document. Returns undefined if the document
	 * database doesn't contain that lexical ID.
	 */
	getWordByLexicalId(lexicalId) {
		return new Promise((resolve) => {
			this._document_db
				.allDocs({ include_docs: true })
				.then((documents) => {
					// Schema-4 migration enforces one PouchDB document per lexical ID.
					const word = documents.rows
						.filter((entry) => entry.doc.lexical_id === lexicalId)
						.map((entry) => entry.doc)[0];
					return resolve(word);
				})
				.catch((e) => {
					handleError('There was an error fetching a bookmark by lexical ID.', e, {
						silent: true,
					});
					resolve(undefined);
				});
		});
	}

	/* Description: Create a word entry object from a given word and list.
	 * Param: Object: word: The word to create the entry for.
	 * Param: String: list: The list ID of the list to add the word to.
	 * Return: Object: The word entry object.
	 */
	_createWordEntry(word, list) {
		if (!isLexicalId(word.lexical_id)) {
			throw new Error('Cannot save a bookmark without a versioned lexical ID.');
		}
		return {
			...DEFAULT_BOOKMARK_DATA,
			lexical_id: word.lexical_id,
			notes: typeof word.notes === 'string' ? word.notes : DEFAULT_BOOKMARK_DATA.notes,
			lists: [list],
		};
	}

	/*
	 * Description: Add a word to a word list.
	 * Param: String: listName: The name of the list to add the word to.
	 * Param: Object: wordToAdd: The word to add to the list.
	 * Return: Promise: Resolves when the word has been added.
	 */
	addToList(listName, wordToAdd) {
		if (!isLexicalId(wordToAdd?.lexical_id)) {
			return Promise.reject(
				new Error('Cannot save a bookmark without a versioned lexical ID.')
			);
		}
		let listId = undefined;
		return new Promise((resolve, reject) => {
			this._list_db
				.allDocs({ include_docs: true })
				.then((lists) => {
					const list = lists.rows
						.filter((list) => list.doc.name === listName)
						.map((list) => list.doc)[0];
					if (!list) {
						reject(
							new Error(
								`There was an error adding the word to ${listName}. List does not exist!`
							)
						);
						throw EARLY_EXIT;
					}
					listId = list._id;
					return this._document_db.allDocs({ include_docs: true });
				})
				.then((documents) => {
					// First, check if this word is already present.
					const words = documents.rows.map((word) => word.doc);
					let word = words.filter(
						(candidate) => candidate.lexical_id === wordToAdd.lexical_id
					)[0];
					if (!word) {
						// If the word doesn't exist yet, create it.
						word = this._createWordEntry(wordToAdd, listId);
						return this._document_db.post(word);
					} else {
						// If the word is already present, update it.
						word.lists.includes(listId) ? undefined : word.lists.push(listId);
						return this._document_db.put(word);
					}
				})
				.then((result) => {
					if (result.ok) {
						resolve();
					} else {
						console.error(result);
						reject(
							new Error(
								`There was an error adding the word to ${listName}. Check the log for more details.`
							)
						);
					}
					return undefined;
				})
				.catch((e) => {
					if (e === EARLY_EXIT) {
						return;
					}
					throw e;
				})
				.catch((e) => {
					console.error(e);
					reject(
						new Error(
							`There was an error adding the word to ${listName}. Check the log for more details.`
						)
					);
				});
		});
	}

	/*
	 * Description: Remove a word from a word list.
	 * Param: String: listName: The name of the list to remove the word from.
	 * Param: Object: word: The word to remove from the list.
	 * Return: Promise: Resolves when the word has been removed from the list.
	 */
	removeFromList(listName, wordToRemove) {
		if (!isLexicalId(wordToRemove?.lexical_id)) {
			return Promise.reject(
				new Error('Cannot remove a bookmark without a versioned lexical ID.')
			);
		}
		let listId = undefined;
		return new Promise((resolve, reject) => {
			this._list_db
				.allDocs({ include_docs: true })
				.then((lists) => {
					const list = lists.rows
						.filter((list) => list.doc.name === listName)
						.map((list) => list.doc)[0];
					if (!list) {
						reject(
							new Error(
								`There was an error removing the word from ${listName}. The list does not exist.`
							)
						);
						throw EARLY_EXIT;
					}
					listId = list._id;
					return this._document_db.allDocs({ include_docs: true });
				})
				.then((documents) => {
					// First, check to make sure the word is present.
					const words = documents.rows.map((word) => word.doc);
					const word = words.filter(
						(candidate) => candidate.lexical_id === wordToRemove.lexical_id
					)[0];
					if (!word) {
						reject(
							new Error(
								`There was an error removing the word from ${listName}. The word does not exist!`
							)
						);
						throw EARLY_EXIT;
					} else {
						word.lists = word.lists.filter((list) => list !== listId);
						return this._document_db.put(word);
					}
				})
				.then((result) => {
					if (result.ok) {
						resolve();
					} else {
						console.error(result);
						reject(
							new Error(
								`There was an error removing the word from ${listName}. Check the log for more details.`
							)
						);
					}
					return undefined;
				})
				.catch((e) => {
					if (e === EARLY_EXIT) {
						return;
					}
					throw e;
				})
				.catch((e) => {
					console.error(e);
					reject(
						new Error(
							`There was an error removing the word from ${listName}. Check the log for more details.`
						)
					);
				});
		});
	}

	/*
	 * Description: Check if a given lexical unit is in any list.
	 * Param: String: lexicalId: The lexical ID to check for.
	 * Return: Promise<Array<String>>: The names of the lists the word is in.
	 */
	inList(lexicalId) {
		let wordLists = undefined;
		return new Promise((resolve, reject) => {
			this.getWordByLexicalId(lexicalId)
				.then((word) => {
					wordLists = word ? word.lists : [];
					return this._list_db.allDocs({ include_docs: true });
				})
				.then((documents) => {
					resolve(
						documents.rows
							.filter((list) => wordLists.includes(list.doc._id))
							.map((list) => list.doc.name)
					);
					return undefined;
				})
				.catch((e) => {
					this._reportDbError('inList', e);
					reject(
						new Error(
							'There was an error fetching bookmarks data. Please check the log for more details.'
						)
					);
				});
		});
	}

	/*
	 * Description: Update a given property for a word entry.
	 * Param: String: lexicalId: The lexical ID of the word to update.
	 * Param: String: name: The property name to update the value for.
	 * Param: Any: value: The property value to update with.
	 * Return: Promise: Resolves when the document has been updated.
	 * Rejects if there were any issues updating the document.
	 */
	updateProperty(lexicalId, name, value) {
		return new Promise((resolve, reject) => {
			this.getWordByLexicalId(lexicalId)
				.then((wordEntry) => {
					// Check to make sure the word is present in the cache
					if (!wordEntry) {
						reject(
							new Error(
								'There was an error updating the bookmarks entry. That word could not be found in any of your lists.'
							)
						);
						throw EARLY_EXIT;
					}

					// Check to make sure the property is editable
					if (!MODIFIABLE_BOOKMARK_PROPERTIES.includes(name)) {
						reject(
							new Error(
								`There was an error updating the bookmarks entry. The property ${name} cannot be updated with this method.`
							)
						);
						throw EARLY_EXIT;
					}

					wordEntry[name] = value;
					return this._document_db.put(wordEntry);
				})
				.then((result) => {
					if (result.ok) {
						resolve();
					} else {
						reject(new Error('There was an error updating the bookmarks entry.'));
					}
					return undefined;
				})
				.catch((e) => {
					if (e === EARLY_EXIT) {
						return;
					}
					throw e;
				})
				.catch((e) => {
					console.error(e);
					reject(
						new Error(
							'There was an error updating the bookmarks entry. Check the log for more details.'
						)
					);
				});
		});
	}
}
