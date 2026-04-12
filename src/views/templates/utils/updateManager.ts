import { check, type Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

/**
 * Checks for an available update, caches the result to window globals, and
 * dispatches the 'update-check-complete' custom event so any listening
 * component can react without polling.
 *
 * Returns the update object if one is available, or null if up to date.
 * Errors are propagated to the caller.
 */
export const checkForUpdate = (): Promise<Update | null> => {
	return check().then((update) => {
		if (update) {
			window.updateVersion = update.version;
			window.updateReleaseNotes = update.body || '';
			window.updateStatusAvailable = true;
			window.updateAvailable = true;
			window.pendingUpdate = update;
		} else {
			window.updateAvailable = false;
			window.updateStatusAvailable = true;
		}
		document.dispatchEvent(
			new CustomEvent('update-check-complete', {
				detail: { updateAvailable: !!update },
			})
		);
		return update;
	});
};

/**
 * Downloads and installs window.pendingUpdate, then relaunches the app.
 * Rejects if there is no pending update.
 */
export const installPendingUpdate = (): Promise<void> => {
	if (!window.pendingUpdate) {
		return Promise.reject(new Error('No pending update available.'));
	}
	return window.pendingUpdate.downloadAndInstall().then(() => relaunch());
};
