// Progress anchors store a short exact/prefix/suffix quote so saved positions can
// be reconciled even when pagination changes.
import type {
	ReaderAssetAttachmentInput,
	ReaderDocument,
	ReaderImportPayload,
	ReaderLocator,
	ReaderSchemaVersion,
} from '@/types/reader.js';

const TEXT_CONTEXT_LENGTH = 32;
const RANDOM_ID_RADIX = 36;
const RANDOM_ID_END = 10;
const NOT_FOUND_STATUS = 404;
const SOURCE_ATTACHMENT_ID = 'source';
const SOURCE_HTML_ATTACHMENT_ID = 'source-html';
// Imported EPUB/PDF image assets are stored as PouchDB attachments under this prefix.
const READER_ASSET_PREFIX = 'assets/';

interface PouchDocument {
	_id: string;
	_rev?: string;
	[key: string]: unknown;
}

interface PouchAllDocsRow {
	doc?: PouchDocument;
}

interface PouchAllDocsResult {
	rows: PouchAllDocsRow[];
}

interface PouchPutResult {
	rev: string;
}

interface PouchError {
	status: number;
	message?: string;
}

interface PouchDB {
	allDocs(options: { include_docs: boolean }): Promise<PouchAllDocsResult>;
	get(id: string): Promise<PouchDocument>;
	put(document: PouchDocument): Promise<PouchPutResult>;
	remove(document: PouchDocument): Promise<void>;
	putAttachment(
		docId: string,
		attachmentId: string,
		rev: string,
		data: Blob,
		type: string
	): Promise<PouchPutResult>;
	getAttachment(docId: string, attachmentId: string): Promise<Blob | ArrayBuffer | Uint8Array>;
}

declare const PouchDB: new (name: string) => PouchDB;

interface ReaderProgress {
	resource_href: string;
	position: number;
	total_progression: number;
	page_index: number;
	text_position: { start: number; end: number };
	text_quote: { exact: string; prefix: string; suffix: string };
	updated_at: string;
}

interface StoredReaderDocument extends PouchDocument {
	canonical_schema_version?: ReaderSchemaVersion;
	title: string;
	file_name: string;
	source_type: string;
	mime_type: string;
	imported_at: string;
	updated_at: string;
	reading_order: Array<{ href: string; type: string; title: string }>;
	progress: ReaderProgress;
	color?: string;
	source_html?: string;
	[key: string]: unknown;
}

const withReaderEnvelopeDefaults = (
	document: PouchDocument | undefined
): StoredReaderDocument | undefined => {
	if (!document) {
		return undefined;
	}
	if (
		document.canonical_schema_version !== undefined &&
		document.canonical_schema_version !== null
	) {
		return document as StoredReaderDocument;
	}
	return {
		...document,
		canonical_schema_version: 1 as ReaderSchemaVersion,
	} as StoredReaderDocument;
};

const createDocumentId = (): string =>
	`reader:${Date.now()}:${Math.random().toString(RANDOM_ID_RADIX).slice(2, RANDOM_ID_END)}`;

const createInitialProgress = (text = '', resourceHref = 'text'): ReaderProgress => {
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

const isBinarySource = (
	sourceData: ArrayBuffer | Uint8Array | number[] | Blob | undefined
): boolean =>
	sourceData instanceof ArrayBuffer ||
	Array.isArray(sourceData) ||
	Boolean((sourceData as Uint8Array)?.byteLength);

const toBlob = (sourceData: ArrayBuffer | Uint8Array | number[] | Blob, mimeType: string): Blob => {
	if (sourceData instanceof Blob) {
		return sourceData;
	}
	if (Array.isArray(sourceData)) {
		return new Blob([new Uint8Array(sourceData)], { type: mimeType });
	}
	return new Blob([sourceData], { type: mimeType });
};

const toArrayBuffer = async (
	attachment: Blob | ArrayBuffer | Uint8Array | undefined
): Promise<ArrayBuffer | undefined> => {
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
	if (typeof (attachment as Blob).arrayBuffer === 'function') {
		return (attachment as Blob).arrayBuffer();
	}
	return undefined;
};

const toText = async (
	attachment: Blob | ArrayBuffer | Uint8Array | string | undefined
): Promise<string | undefined> => {
	if (!attachment) {
		return undefined;
	}
	if (typeof attachment === 'string') {
		return attachment;
	}
	if (typeof (attachment as Blob).text === 'function') {
		return (attachment as Blob).text();
	}
	const arrayBuffer = await toArrayBuffer(attachment as Blob | ArrayBuffer | Uint8Array);
	if (!arrayBuffer) {
		return undefined;
	}
	return new TextDecoder().decode(arrayBuffer);
};

export class ReaderDocumentManager {
	initialized: boolean;
	_document_db: PouchDB;

	constructor(documentDb: string) {
		this.initialized = false;
		this._document_db = new PouchDB(documentDb);
	}

	init(): Promise<void> {
		return this._document_db
			.allDocs({ include_docs: true })
			.then(() => {
				this.initialized = true;
				return undefined;
			})
			.catch((error: unknown) => {
				console.error(error);
				throw new Error('There was an error loading reader documents.');
			});
	}

	waitForInit(): Promise<void> {
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

	createDocument(importPayload: ReaderImportPayload): Promise<StoredReaderDocument> {
		const now = new Date().toISOString();
		const documentId = createDocumentId();
		const {
			source_data,
			source_html,
			asset_attachments = [],
			...storedPayload
		} = importPayload;
		const resourceHref = importPayload.source_type === 'plain_text' ? 'text' : 'source';
		const document: StoredReaderDocument = {
			_id: documentId,
			...storedPayload,
			canonical_schema_version:
				importPayload.canonical_schema_version ?? (1 as ReaderSchemaVersion),
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

		const putAssetChain = (
			startingRev: string,
			attachments: ReaderAssetAttachmentInput[]
		): Promise<string> => {
			if (!attachments.length) {
				return Promise.resolve(startingRev);
			}
			return attachments.reduce(
				(chain, asset) =>
					chain.then((rev) =>
						this._document_db
							.putAttachment(
								documentId,
								`${READER_ASSET_PREFIX}${asset.asset_id}`,
								rev,
								toBlob(asset.data, asset.mime_type),
								asset.mime_type
							)
							.then((attachmentResult) => attachmentResult.rev)
					),
				Promise.resolve(startingRev)
			);
		};

		const putSourceHtml = (startingRev: string): Promise<string> => {
			if (!source_html) {
				return Promise.resolve(startingRev);
			}
			return this._document_db
				.putAttachment(
					documentId,
					SOURCE_HTML_ATTACHMENT_ID,
					startingRev,
					new Blob([source_html], { type: 'text/html' }),
					'text/html'
				)
				.then((attachmentResult) => attachmentResult.rev);
		};

		return this._document_db
			.put(document as PouchDocument)
			.then((result) => {
				let revision = result.rev;
				if (isBinarySource(source_data)) {
					return this._document_db
						.putAttachment(
							documentId,
							SOURCE_ATTACHMENT_ID,
							revision,
							toBlob(source_data!, importPayload.mime_type),
							importPayload.mime_type
						)
						.then((attachmentResult) => {
							revision = attachmentResult.rev;
							return putSourceHtml(revision);
						})
						.then((htmlRev) => {
							revision = htmlRev;
							return putAssetChain(revision, asset_attachments);
						})
						.then((finalRev) => ({
							...document,
							_rev: finalRev,
						}));
				}
				return putSourceHtml(revision)
					.then((htmlRev) => putAssetChain(htmlRev, asset_attachments))
					.then((finalRev) => ({
						...document,
						_rev: finalRev,
					}));
			})
			.catch((error: unknown) => {
				console.error(error);
				throw new Error('There was an error saving the imported reader document.');
			});
	}

	getDocuments(): Promise<StoredReaderDocument[]> {
		return this._document_db
			.allDocs({ include_docs: true })
			.then((documents) =>
				documents.rows
					.map((row) => withReaderEnvelopeDefaults(row.doc))
					.filter((document): document is StoredReaderDocument => Boolean(document))
					.sort((left, right) => right.imported_at.localeCompare(left.imported_at))
			)
			.catch((error: unknown) => {
				console.error(error);
				throw new Error('There was an error fetching reader documents.');
			});
	}

	getDocument(id: string): Promise<StoredReaderDocument | undefined> {
		return this._document_db
			.get(id)
			.then((document) => withReaderEnvelopeDefaults(document))
			.catch((error: PouchError) => {
				if (error.status === NOT_FOUND_STATUS) {
					return undefined;
				}
				console.error(error);
				throw new Error('There was an error fetching the reader document.');
			});
	}

	getSourceData(id: string): Promise<ArrayBuffer | undefined> {
		return this._document_db
			.getAttachment(id, SOURCE_ATTACHMENT_ID)
			.then((attachment) => toArrayBuffer(attachment))
			.catch((error: PouchError) => {
				if (error.status === NOT_FOUND_STATUS) {
					return undefined;
				}
				console.error(error);
				throw new Error('There was an error loading the reader document source.');
			});
	}

	getSourceHtml(id: string): Promise<string | undefined> {
		return this._document_db
			.getAttachment(id, SOURCE_HTML_ATTACHMENT_ID)
			.then((attachment) => toText(attachment))
			.catch((error: PouchError) => {
				if (error.status === NOT_FOUND_STATUS) {
					return this._document_db
						.get(id)
						.then((document) => document.source_html as string | undefined);
				}
				console.error(error);
				throw new Error('There was an error loading the reader document HTML source.');
			});
	}

	getAssetData(id: string, assetId: string): Promise<ArrayBuffer | undefined> {
		return this._document_db
			.getAttachment(id, `${READER_ASSET_PREFIX}${assetId}`)
			.then((attachment) => toArrayBuffer(attachment))
			.catch((error: PouchError) => {
				if (error.status === NOT_FOUND_STATUS) {
					return undefined;
				}
				console.error(error);
				throw new Error('There was an error loading a reader document asset.');
			});
	}

	updateProgress(id: string, progress: ReaderLocator): Promise<StoredReaderDocument> {
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
				return this._document_db.put(updatedDocument as PouchDocument).then((result) => ({
					...updatedDocument,
					_rev: result.rev,
				})) as Promise<StoredReaderDocument>;
			})
			.catch((error: unknown) => {
				console.error(error);
				throw new Error('There was an error saving reader progress.');
			});
	}

	updateMetadata(
		id: string,
		metadata: { title: string; color: string }
	): Promise<StoredReaderDocument> {
		return this._document_db
			.get(id)
			.then((document) => {
				const readingOrder =
					(document.reading_order as Array<{
						href: string;
						type: string;
						title: string;
					}>) ?? [];
				const updatedDocument = {
					...document,
					title: metadata.title,
					color: metadata.color,
					updated_at: new Date().toISOString(),
					reading_order: readingOrder.map((item) => ({
						...item,
						title: metadata.title,
					})),
				};
				return this._document_db.put(updatedDocument as PouchDocument).then((result) => ({
					...updatedDocument,
					_rev: result.rev,
				})) as Promise<StoredReaderDocument>;
			})
			.catch((error: unknown) => {
				console.error(error);
				throw new Error('There was an error saving reader document details.');
			});
	}

	deleteDocument(id: string): Promise<void> {
		return this._document_db
			.get(id)
			.then((document) => this._document_db.remove(document))
			.catch((error: unknown) => {
				console.error(error);
				throw new Error('There was an error removing the reader document.');
			});
	}
}
