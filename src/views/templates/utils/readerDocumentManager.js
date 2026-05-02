const TEXT_CONTEXT_LENGTH = 32;
const RANDOM_ID_RADIX = 36;
const RANDOM_ID_END = 10;
const NOT_FOUND_STATUS = 404;
const SOURCE_ATTACHMENT_ID = 'source';

const createDocumentId = () =>
	`reader:${Date.now()}:${Math.random().toString(RANDOM_ID_RADIX).slice(2, RANDOM_ID_END)}`;

const createInitialProgress = (text = '', resourceHref = 'text') => {
	const exact = text.slice(0, TEXT_CONTEXT_LENGTH);
	const now = new Date().toISOString();
	return {
		resource_href: resourceHref,
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

const isBinarySource = (sourceData) => sourceData instanceof ArrayBuffer || sourceData?.byteLength;

const toBlob = (sourceData, mimeType) => {
	if (sourceData instanceof Blob) {
		return sourceData;
	}
	return new Blob([sourceData], { type: mimeType });
};

const toArrayBuffer = async (attachment) => {
	if (!attachment) {
		return undefined;
	}
	if (attachment instanceof ArrayBuffer) {
		return attachment.slice(0);
	}
	if (attachment instanceof Uint8Array) {
		const copy = new Uint8Array(attachment.byteLength);
		copy.set(attachment);
		return copy.buffer;
	}
	if (typeof attachment.arrayBuffer === 'function') {
		return attachment.arrayBuffer();
	}
	return undefined;
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
		const { source_data, ...storedPayload } = importPayload;
		const resourceHref = importPayload.source_type === 'plain_text' ? 'text' : 'source';
		const document = {
			_id: documentId,
			...storedPayload,
			imported_at: now,
			updated_at: now,
			reading_order: [
				{
					href: resourceHref,
					type: importPayload.mime_type,
					title: importPayload.title,
				},
			],
			progress: createInitialProgress(importPayload.text, resourceHref),
		};

		return this._document_db
			.put(document)
			.then((result) => {
				if (!isBinarySource(source_data)) {
					return {
						...document,
						_rev: result.rev,
					};
				}
				return this._document_db
					.putAttachment(
						documentId,
						SOURCE_ATTACHMENT_ID,
						result.rev,
						toBlob(source_data, importPayload.mime_type),
						importPayload.mime_type
					)
					.then((attachmentResult) => ({
						...document,
						_rev: attachmentResult.rev,
					}));
			})
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

	getSourceData(id) {
		return this._document_db
			.getAttachment(id, SOURCE_ATTACHMENT_ID)
			.then((attachment) => toArrayBuffer(attachment))
			.catch((e) => {
				if (e.status === NOT_FOUND_STATUS) {
					return undefined;
				}
				console.error(e);
				throw new Error('There was an error loading the reader document source.');
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

	updateMetadata(id, metadata) {
		return this._document_db
			.get(id)
			.then((document) => {
				const updatedDocument = {
					...document,
					title: metadata.title,
					color: metadata.color,
					updated_at: new Date().toISOString(),
					reading_order: (document.reading_order ?? []).map((item) => ({
						...item,
						title: metadata.title,
					})),
				};
				return this._document_db.put(updatedDocument).then((result) => ({
					...updatedDocument,
					_rev: result.rev,
				}));
			})
			.catch((e) => {
				console.error(e);
				throw new Error('There was an error saving reader document details.');
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
