const TEXT_CONTEXT_LENGTH = 32;
const RANDOM_ID_RADIX = 36;
const RANDOM_ID_END = 10;
const NOT_FOUND_STATUS = 404;

const createDocumentId = () =>
	`reader:${Date.now()}:${Math.random().toString(RANDOM_ID_RADIX).slice(2, RANDOM_ID_END)}`;

const createInitialProgress = (text) => {
	const exact = text.slice(0, TEXT_CONTEXT_LENGTH);
	const now = new Date().toISOString();
	return {
		resource_href: 'text',
		position: 0,
		total_progression: 0,
		page_index: 0,
		text_position: {
			start: 0,
			end: exact.length,
		},
		text_quote: {
			exact,
			prefix: '',
			suffix: text.slice(exact.length, exact.length + TEXT_CONTEXT_LENGTH),
		},
		updated_at: now,
	};
};

export class ReaderDocumentManager {
	constructor(documentDb) {
		this.initialized = false;
		this._document_db = new PouchDB(documentDb);
	}

	init() {
		return this._document_db
			.allDocs({ include_docs: true })
			.then(() => {
				this.initialized = true;
				return undefined;
			})
			.catch((e) => {
				console.error(e);
				throw new Error('There was an error loading reader documents.');
			});
	}

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

	createDocument(importPayload) {
		const now = new Date().toISOString();
		const documentId = createDocumentId();
		const document = {
			_id: documentId,
			...importPayload,
			imported_at: now,
			updated_at: now,
			reading_order: [
				{
					href: 'text',
					type: importPayload.mime_type,
					title: importPayload.title,
				},
			],
			progress: createInitialProgress(importPayload.text),
		};

		return this._document_db
			.put(document)
			.then((result) => ({
				...document,
				_rev: result.rev,
			}))
			.catch((e) => {
				console.error(e);
				throw new Error('There was an error saving the imported reader document.');
			});
	}

	getDocuments() {
		return this._document_db
			.allDocs({ include_docs: true })
			.then((documents) =>
				documents.rows
					.map((row) => row.doc)
					.filter(Boolean)
					.sort((left, right) => right.imported_at.localeCompare(left.imported_at))
			)
			.catch((e) => {
				console.error(e);
				throw new Error('There was an error fetching reader documents.');
			});
	}

	getDocument(id) {
		return this._document_db.get(id).catch((e) => {
			if (e.status === NOT_FOUND_STATUS) {
				return undefined;
			}
			console.error(e);
			throw new Error('There was an error fetching the reader document.');
		});
	}

	updateProgress(id, progress) {
		return this._document_db
			.get(id)
			.then((document) => {
				const updatedDocument = {
					...document,
					updated_at: new Date().toISOString(),
					progress: {
						...progress,
						updated_at: new Date().toISOString(),
					},
				};
				return this._document_db.put(updatedDocument).then((result) => ({
					...updatedDocument,
					_rev: result.rev,
				}));
			})
			.catch((e) => {
				console.error(e);
				throw new Error('There was an error saving reader progress.');
			});
	}

	deleteDocument(id) {
		return this._document_db
			.get(id)
			.then((document) => this._document_db.remove(document))
			.catch((e) => {
				console.error(e);
				throw new Error('There was an error removing the reader document.');
			});
	}
}
