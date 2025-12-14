/*
 * File: bookmarkManager.js
 * Description: Describes the bookmark manager to read and write bookmarks.
 * An instance of BookmarkManager class is created from a desired pouchdb.
 * After initialization the bookmarks are ready to be read and written.
 */
// Default bookmark data
const DEFAULT_BOOKMARK_DATA = {
	lists: [],
	notes: ''
};

// Which properties of a word entry that should be modifiable
// through the `updateProperty` method.
const MODIFIABLE_BOOKMARK_PROPERTIES = [
	'notes'
];

function BreakException() { }

export class BookmarkManager {
	/*
   * Description: Construct an instance of the bookmark manager.
	 * Param: String: listDb: The name of the list database to use.
	 * Param: String: documentDb: The name of the document database to use.
   * Return: BookmarkManager: The BookmarkManager instance.
   */
	constructor(listDb, documentDb) {
		this.initialized = false;
		this._list_db = new PouchDB(listDb);
		this._document_db = new PouchDB(documentDb);
	}

	/*
   * Description: Load the bookmarks. If no bookmarks data is present initialize it.
   * Return: Promise: Returns a Promise that resolves to undefined when the bookmarks
   * have loaded; fatally rejects if the bookmarks cannot be loaded or created.
   */
	init() {
		return new Promise((resolve, reject) => {
			this._list_db.allDocs({ include_docs: true }).then(documents => {
				// Syng expects there to always be a bookmarks list. If a bookmarks
				// list is not present, initialize it.
				if (!documents.rows.map(list => list.doc.name).includes('Bookmarks')) {
					return this._list_db.post({ name: 'Bookmarks' }).then(result => {
						if (result.ok) {
							this.initialized = true;
							resolve();
						} else {
							console.error(result);
							reject(new Error('There was an error initializing the bookmarks data. Check the logs for more details.'));
							throw new BreakException();
						}
						return undefined;
					}).catch(e => {
						console.error(e);
						reject(new Error('There was an error initializing the bookmarks data. Check the logs for more details.'));
						throw new BreakException();
					});
				}
				this.initialized = true;
				resolve();
				return undefined;
			}).catch(BreakException, () => undefined).catch(e => {
				console.error(e);
				reject(new Error('There was an error loading bookmarks data. Check the logs for more details.'));
			});
		});
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

	/*
	 * Description: Get a list of the word lists
	 * Return: Promise<Array<String>>: Returns a Promise that resolves with a list of
	 * strings representing the names of the available word lists.
	 */
	getLists() {
		return new Promise((resolve, reject) => {
			this._list_db.allDocs({ include_docs: true }).then(documents => {
				resolve(documents.rows.map(list => list.doc.name));
				return undefined;
			}).catch(e => {
				console.error(e);
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
			this._list_db.allDocs({ include_docs: true }).then(documents => {
				lists = documents.rows.map(list => list.doc);
				return this._document_db.allDocs({ include_docs: true });
			}).then(wordsResult => {
				const wordDocs = wordsResult.rows.map(word => word.doc);

				const emptyLists = lists.filter(list => {
					const listId = list._id;
					const listContents = wordDocs.filter(word => word.lists.includes(listId));
					return !listContents.length;
				}).map(list => list.name);

				resolve(emptyLists);
				return undefined;
			}).catch(e => {
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
			this._list_db.allDocs({ include_docs: true }).then(documents => {
				return documents.rows.map(list => list.doc.name);
			}).then(lists => {
				// List names should be unique
				if (lists.includes(listName)) {
					reject(new Error(`Cannot create list. A list with the name ${listName} already exists.`));
					throw new BreakException();
				}

				// Create the new list.
				return this._list_db.post({ name: listName });
			}).then(result => {
				if (result.ok) {
					resolve();
				} else {
					console.error(result);
					reject(new Error(`There was an error while creating ${listName}. Check the logs for more details.`));
				}
				return undefined;
			}).catch(BreakException, () => undefined).catch(e => {
				console.error(e);
				reject(new Error(`There was an error while creating ${listName}. Check the logs for more details.`));
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
			this._list_db.allDocs({ include_docs: true }).then(documents => {
				const listToRemove = documents.rows.filter(list => list.doc.name === listName)[0];
				if (!listToRemove) {
					reject(new Error(`There was an error deleting the list ${listName}. The list does not exist.`));
					throw new BreakException();
				}

				listToRemove.doc._deleted = true;
				listId = listToRemove.doc._id;
				return this._list_db.put(listToRemove.doc);
			}).then(result => {
				if (result.ok) {
					// Now that we've removed the list, we should remove the list from all associated words
					return this._document_db.allDocs({ include_docs: true });
				} else {
					console.error(result);
					reject((`There was an error deleting the list ${listName}. Check the log for more details.`));
					throw new BreakException();
				}
			}).then(documents => {
				const words = documents.rows.map(doc => doc.doc);
				for (let i = 0; i < words.length; i++) {
					const word = words[i];
					word.lists = word.lists.filter(id => id !== listId);
					if (!word.lists.length) {
						word._deleted = true;
					}
				}

				// Update or remove the bookmarked words
				return this._document_db.bulkDocs(words);
			}).then(results => {
				if (results.map(result => result.ok).includes(false)) {
					console.error(results);
					reject(new Error(`There was an error deleting the list ${listName}. Check the log for more details.`));
				} else {
					resolve();
				}
				return undefined;
			}).catch(BreakException, () => undefined).catch(e => {
				console.error(e);
				reject(new Error(`There was an error deleting the list ${listName}. Check the log for more details.`));
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
			this._list_db.allDocs({ include_docs: true }).then(documents => {
				const list = documents.rows.filter(list => list.doc.name === listName)[0];
				if (!list) {
					console.error(documents);
					reject(new Error(`There was an error fetching the contents of ${listName}. List does not exist! Check the log for more details.`));
					throw new BreakException();
				}

				listId = list.doc._id;
				return this._document_db.allDocs({ include_docs: true });
			}).then(documents => {
				resolve(documents.rows.filter(word => word.doc.lists.includes(listId)).map(word => word.doc));
				return undefined;
			}).catch(BreakException, () => undefined).catch(e => {
				console.error(e);
				reject(new Error(`There was an error loading the list ${listName}. Check the log for more details.`));
			});
		});
	}

	/*
	 * Description: Get a word entry document by its hash.
	 * Param: String: hash: The hash of the word entry to get.
	 * Return: Promise<Object>: The word entry document. Returns undefined if the document
	 * database doesn't contain a word with that hash.
	 */
	getWordByHash(hash) {
		return new Promise((resolve) => {
			this._document_db.allDocs({ include_docs: true }).then(documents => {
				// Syng expects the entries in the document DB to be unique by hash.
				resolve(documents.rows.filter(word => word.doc.hash === hash).map(word => word.doc)[0]);
				return undefined;
			}).catch(e => {
				console.error(e);
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
		const wordEntry = {
			...DEFAULT_BOOKMARK_DATA,
			...word
		};
		wordEntry.lists = [list];
		return wordEntry;
	}

	/*
	 * Description: Add a word to a word list.
	 * Param: String: listName: The name of the list to add the word to.
	 * Param: Object: wordToAdd: The word to add to the list.
	 * Return: Promise: Resolves when the word has been added.
	 */
	addToList(listName, wordToAdd) {
		let listId = undefined;
		return new Promise((resolve, reject) => {
			this._list_db.allDocs({ include_docs: true }).then(lists => {
				const list = lists.rows.filter(list => list.doc.name === listName).map(list => list.doc)[0];
				if (!list) {
					reject(new Error(`There was an error adding the word to ${listName}. List does not exist!`));
					throw new BreakException();
				}
				listId = list._id;
				return this._document_db.allDocs({ include_docs: true });
			}).then(documents => {
				// First, check if this word is already present.
				const words = documents.rows.map(word => word.doc);
				let word = words.filter(word => word.hash === wordToAdd.hash)[0];
				if (!word) {
					// If the word doesn't exist yet, create it.
					word = this._createWordEntry(wordToAdd, listId);
					return this._document_db.post(word);
				} else {
					// If the word is already present, update it.
					word.lists.includes(listId) ? undefined : word.lists.push(listId);
					return this._document_db.put(word);
				}
			}).then(result => {
				if (result.ok) {
					resolve();
				} else {
					console.error(result);
					reject(new Error(`There was an error adding the word to ${listName}. Check the log for more details.`));
				}
				return undefined;
			}).catch(BreakException, () => undefined).catch(e => {
				console.error(e);
				reject(new Error(`There was an error adding the word to ${listName}. Check the log for more details.`));
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
		let listId = undefined;
		return new Promise((resolve, reject) => {
			this._list_db.allDocs({ include_docs: true }).then(lists => {
				const list = lists.rows.filter(list => list.doc.name === listName).map(list => list.doc)[0];
				if (!list) {
					reject(new Error(`There was an error removing the word from ${listName}. The list does not exist.`));
					throw new BreakException();
				}
				listId = list._id;
				return this._document_db.allDocs({ include_docs: true });
			}).then(documents => {
				// First, check to make sure the word is present.
				const words = documents.rows.map(word => word.doc);
				const word = words.filter(word => word.hash === wordToRemove.hash)[0];
				if (!word) {
					reject(new Error(`There was an error removing the word from ${listName}. The word does not exist!`));
					throw new BreakException();
				} else {
					word.lists = word.lists.filter(list => list !== listId);
					return this._document_db.put(word);
				}
			}).then(result => {
				if (result.ok) {
					resolve();
				} else {
					console.error(result);
					reject(new Error(`There was an error removing the word from ${listName}. Check the log for more details.`));
				}
				return undefined;
			}).catch(BreakException, () => undefined).catch(e => {
				console.error(e);
				reject(new Error(`There was an error removing the word from ${listName}. Check the log for more details.`));
			});
		});
	}

	/*
	 * Description: Check if a given word is in any list.
	 * Param: String: hash: The hash field of the word to check for.
	 * Return: Promise<Array<String>>: The names of the lists the word is in.
	 */
	inList(hash) {
		let wordLists = undefined;
		return new Promise((resolve, reject) => {
			this.getWordByHash(hash).then(word => {
				wordLists = word ? word.lists : [];
				return this._list_db.allDocs({ include_docs: true });
			}).then(documents => {
				resolve(documents.rows.filter(list => wordLists.includes(list.doc._id)).map(list => list.doc.name));
				return undefined;
			}).catch(e => {
				console.error(e);
				reject(new Error('There was an error fetching bookmarks data. Please check the log for more details.'));
			});
		});
	}

	/*
	 * Description: Update a given property for a word entry.
	 * Param: String: hash: The hash field of the word to update.
	 * Param: String: name: The property name to update the value for.
	 * Param: Any: value: The property value to update with.
	 * Return: Promise: Resolves when the document has been updated.
	 * Rejects if there were any issues updating the document.
	 */
	updateProperty(hash, name, value) {
		return new Promise((resolve, reject) => {
			this.getWordByHash(hash).then(wordEntry => {
				// Check to make sure the word is present in the cache
				if (!wordEntry) {
					reject(new Error('There was an error updating the bookmarks entry. That word could not be found in any of your lists.'));
					throw new BreakException();
				}

				// Check to make sure the property is editable
				if (!MODIFIABLE_BOOKMARK_PROPERTIES.includes(name)) {
					reject(new Error(`There was an error updating the bookmarks entry. The property ${name} cannot be updated with this method.`));
					throw new BreakException();
				}

				wordEntry[name] = value;
				return this._document_db.put(wordEntry);
			}).then(result => {
				if (result.ok) {
					resolve();
				} else {
					reject(new Error('There was an error updating the bookmarks entry.'));
				}
				return undefined;
			}).catch(BreakException, () => undefined).catch(e => {
				console.error(e);
				reject(new Error('There was an error updating the bookmarks entry. Check the log for more details.'));
			});
		});
	}
}