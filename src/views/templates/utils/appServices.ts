import { BookmarkManager } from '@/utils/bookmarkManager.js';
import { PreferenceManager } from '@/utils/preferenceManager.js';
import { ReaderDocumentManager } from '@/utils/readerDocumentManager.js';

type PreferenceManagerInstance = InstanceType<typeof PreferenceManager>;
type BookmarkManagerInstance = InstanceType<typeof BookmarkManager>;
type ReaderDocumentManagerInstance = InstanceType<typeof ReaderDocumentManager>;

let preferenceManager: PreferenceManagerInstance | null = null;
let bookmarkManager: BookmarkManagerInstance | null = null;
let readerDocumentManager: ReaderDocumentManagerInstance | null = null;

const requireService = <T>(service: T | null, name: string): T => {
	if (!service) {
		throw new Error(`${name} has not been initialized. Call runStartupActions() first.`);
	}
	return service;
};

export const createAppServices = (
	configDb: string,
	listDb: string,
	bookmarkDb: string,
	readerDocumentDb: string
): {
	preferenceManager: PreferenceManagerInstance;
	bookmarkManager: BookmarkManagerInstance;
	readerDocumentManager: ReaderDocumentManagerInstance;
} => {
	preferenceManager = new PreferenceManager(configDb);
	bookmarkManager = new BookmarkManager(listDb, bookmarkDb);
	readerDocumentManager = new ReaderDocumentManager(readerDocumentDb);

	return {
		preferenceManager,
		bookmarkManager,
		readerDocumentManager,
	};
};

export const getPreferenceManager = (): PreferenceManagerInstance =>
	requireService(preferenceManager, 'PreferenceManager');

export const getBookmarkManager = (): BookmarkManagerInstance =>
	requireService(bookmarkManager, 'BookmarkManager');

export const getReaderDocumentManager = (): ReaderDocumentManagerInstance =>
	requireService(readerDocumentManager, 'ReaderDocumentManager');

export const setPreferenceManagerForTest = (manager: PreferenceManagerInstance): void => {
	preferenceManager = manager;
};

export const setBookmarkManagerForTest = (manager: BookmarkManagerInstance): void => {
	bookmarkManager = manager;
};

export const setReaderDocumentManagerForTest = (manager: ReaderDocumentManagerInstance): void => {
	readerDocumentManager = manager;
};

export const resetAppServicesForTest = (): void => {
	preferenceManager = null;
	bookmarkManager = null;
	readerDocumentManager = null;
};
