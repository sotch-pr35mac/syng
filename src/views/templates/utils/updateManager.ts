import { invoke } from '@tauri-apps/api/core';
import { Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { updateStore } from '@/stores/update.svelte.js';
import { getBookmarkManager, getPreferenceManager } from '@/utils/appServices.js';
import { exportMigrationData } from '@/utils/migrationManager.js';
import { handleError } from '@/utils/error.js';
import { NATIVE_COMMANDS } from '@/types/nativeCommands.js';
import { networkStatus } from '@/utils/networkStatus.svelte.js';

async function updateStep<Result>(
	stage: string | (() => string),
	operation: () => Promise<Result>,
	trigger: 'startup' | 'manual' = 'manual'
): Promise<Result> {
	const startedAt = performance.now();
	try {
		return await operation();
	} catch (cause) {
		// Object identity lets callers show their normal UI without reporting twice.
		const error =
			cause instanceof Error ? cause : new Error('Update operation failed', { cause });
		handleError('Update operation failed', error, {
			silent: true,
			context: {
				operation: 'updater',
				stage: typeof stage === 'function' ? stage() : stage,
				trigger,
				service: 'app_updates',
				duration_ms: Math.round(performance.now() - startedAt),
			},
		});
		throw error;
	}
}

/**
 * Checks for an available update and caches the result in the update store.
 *
 * Returns the update object if one is available, or null if up to date.
 * Errors are propagated to the caller.
 */
export const checkForUpdate = (
	trigger: 'startup' | 'manual' = 'manual'
): Promise<Update | null> => {
	if (networkStatus.isOffline) {
		return Promise.resolve(null);
	}
	return updateStep(
		'check',
		async () => {
			const metadata = await invoke<ConstructorParameters<typeof Update>[0] | null>(
				NATIVE_COMMANDS.APP.CHECK_FOR_UPDATE
			);
			const update = metadata ? new Update(metadata) : null;
			updateStore.setCheckResult(update);
			return update;
		},
		trigger
	);
};

/**
 * Downloads and installs the pending update, then relaunches the app.
 * Rejects if there is no pending update.
 */
export const installPendingUpdate = (): Promise<void> => {
	if (networkStatus.isOffline) {
		return Promise.resolve();
	}
	// Snapshot the update object before the async backup runs; UI error handling can reset the store.
	const pendingUpdate = updateStore.pendingUpdate;
	if (!pendingUpdate) {
		return Promise.reject(new Error('No pending update available.'));
	}
	return updateStep('backup', () =>
		exportMigrationData(getPreferenceManager(), getBookmarkManager())
	)
		.then(() => {
			// The plugin's Finished callback separates download from signature verification/install.
			let stage = 'download';
			return updateStep(
				() => stage,
				() =>
					pendingUpdate.downloadAndInstall((event) => {
						if (event.event === 'Finished') {
							stage = 'install';
						}
					})
			);
		})
		.then(() => updateStep('relaunch', () => relaunch()));
};
