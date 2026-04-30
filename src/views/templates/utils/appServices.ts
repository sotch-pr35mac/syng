import { BookmarkManager } from '@/utils/bookmarkManager.js';
import { PreferenceManager } from '@/utils/preferenceManager.js';

type PreferenceManagerInstance = InstanceType<typeof PreferenceManager>;
type BookmarkManagerInstance = InstanceType<typeof BookmarkManager>;

let preferenceManager: PreferenceManagerInstance | null = null;
let bookmarkManager: BookmarkManagerInstance | null = null;

const requireService = <T>(service: T | null, name: string): T => {
	if (!service) {
		throw new Error(`${name} has not been initialized. Call runStartupActions() first.`);
	}
	return service;
};

export const createAppServices = (
	configDb: string,
	listDb: string,
	bookmarkDb: string
): {
	preferenceManager: PreferenceManagerInstance;
	bookmarkManager: BookmarkManagerInstance;
} => {
	preferenceManager = new PreferenceManager(configDb);
	bookmarkManager = new BookmarkManager(listDb, bookmarkDb);

	return {
		preferenceManager,
		bookmarkManager,
	};
};

export const getPreferenceManager = (): PreferenceManagerInstance =>
	requireService(preferenceManager, 'PreferenceManager');

export const getBookmarkManager = (): BookmarkManagerInstance =>
	requireService(bookmarkManager, 'BookmarkManager');

export const setPreferenceManagerForTest = (manager: PreferenceManagerInstance): void => {
	preferenceManager = manager;
};

export const setBookmarkManagerForTest = (manager: BookmarkManagerInstance): void => {
	bookmarkManager = manager;
};

export const resetAppServicesForTest = (): void => {
	preferenceManager = null;
	bookmarkManager = null;
};
