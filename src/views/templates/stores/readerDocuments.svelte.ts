import type { ReaderDocument, ReaderImportPayload, ReaderLocator } from '@/types/reader.js';
import { getReaderDocumentManager } from '@/utils/appServices.js';
import { normalizeReaderDocumentColor } from '@/utils/readerDocument.js';
import { handleError } from '@/utils/error.js';

let documents = $state<ReaderDocument[]>([]);
let initialized = $state(false);

async function ensureManagerReady(): Promise<void> {
	await getReaderDocumentManager().waitForInit();
}

async function refresh(): Promise<void> {
	try {
		await ensureManagerReady();
		documents = await getReaderDocumentManager().getDocuments();
		initialized = true;
	} catch (error) {
		handleError(
			'There was an error fetching reader documents. Check the logs for more details.',
			error
		);
	}
}

async function importDocument(importPayload: ReaderImportPayload): Promise<ReaderDocument> {
	await ensureManagerReady();
	const document = await getReaderDocumentManager().createDocument(importPayload);
	documents = [document, ...documents];
	return document;
}

async function deleteDocument(id: string): Promise<void> {
	await ensureManagerReady();
	await getReaderDocumentManager().deleteDocument(id);
	documents = documents.filter((document) => document._id !== id);
}

async function updateProgress(id: string, progress: ReaderLocator): Promise<ReaderDocument> {
	await ensureManagerReady();
	const document = await getReaderDocumentManager().updateProgress(id, progress);
	documents = documents.map((existing) => (existing._id === id ? document : existing));
	return document;
}

async function updateMetadata(
	id: string,
	metadata: { title: string; color: string }
): Promise<ReaderDocument> {
	await ensureManagerReady();
	const document = await getReaderDocumentManager().updateMetadata(id, {
		title: metadata.title.trim() || 'Untitled',
		color: normalizeReaderDocumentColor(metadata.color),
	});
	documents = documents.map((existing) => (existing._id === id ? document : existing));
	return document;
}

async function getDocument(id: string): Promise<ReaderDocument | undefined> {
	await ensureManagerReady();
	return getReaderDocumentManager().getDocument(id);
}

async function getSourceData(id: string): Promise<ArrayBuffer | undefined> {
	await ensureManagerReady();
	return getReaderDocumentManager().getSourceData(id);
}

async function getSourceHtml(id: string): Promise<string | undefined> {
	await ensureManagerReady();
	return getReaderDocumentManager().getSourceHtml(id);
}

export const readerDocumentsStore = {
	get documents(): ReaderDocument[] {
		return documents;
	},
	get initialized(): boolean {
		return initialized;
	},
	refresh,
	importDocument,
	deleteDocument,
	updateProgress,
	updateMetadata,
	getDocument,
	getSourceData,
	getSourceHtml,
};
