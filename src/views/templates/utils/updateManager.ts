import { check, type Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { updateStore } from '@/stores/update.svelte.js';

/**
 * Checks for an available update and caches the result in the update store.
 *
 * Returns the update object if one is available, or null if up to date.
 * Errors are propagated to the caller.
 */
export const checkForUpdate = (): Promise<Update | null> => {
	return check().then((update) => {
		updateStore.setCheckResult(update);
		return update;
	});
};

/**
 * Downloads and installs the pending update, then relaunches the app.
 * Rejects if there is no pending update.
 */
export const installPendingUpdate = (): Promise<void> => {
	if (!updateStore.pendingUpdate) {
		return Promise.reject(new Error('No pending update available.'));
	}
	return updateStore.pendingUpdate.downloadAndInstall().then(() => relaunch());
};
