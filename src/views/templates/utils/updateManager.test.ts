import { beforeEach, expect, it, vi } from 'vitest';
import type { Update } from '@tauri-apps/plugin-updater';

const mocks = vi.hoisted(() => ({
	invoke: vi.fn(),
	handleError: vi.fn(),
	relaunch: vi.fn(),
	exportMigrationData: vi.fn(),
	preferenceManager: {},
	bookmarkManager: {},
}));

vi.mock('@tauri-apps/api/core', async (importOriginal) => ({
	...(await importOriginal<typeof import('@tauri-apps/api/core')>()),
	invoke: mocks.invoke,
}));
vi.mock('@/utils/error.js', () => ({ handleError: mocks.handleError }));

vi.mock('@tauri-apps/plugin-process', () => ({
	relaunch: mocks.relaunch,
}));

vi.mock('@/utils/appServices.js', () => ({
	getPreferenceManager: vi.fn(() => mocks.preferenceManager),
	getBookmarkManager: vi.fn(() => mocks.bookmarkManager),
}));

vi.mock('@/utils/migrationManager.js', () => ({
	exportMigrationData: mocks.exportMigrationData,
}));

import { updateStore } from '@/stores/update.svelte.js';
import { checkForUpdate, installPendingUpdate } from '@/utils/updateManager.js';
import { networkStatus } from '@/utils/networkStatus.svelte.js';

const makeUpdate = () =>
	({
		version: '2.0.1',
		body: '',
		downloadAndInstall: vi.fn(() => Promise.resolve()),
	}) as unknown as Update & { downloadAndInstall: ReturnType<typeof vi.fn> };

beforeEach(() => {
	updateStore.resetStatus();
	mocks.invoke.mockReset();
	mocks.handleError.mockReset();
	mocks.relaunch.mockReset();
	mocks.relaunch.mockResolvedValue(undefined);
	mocks.exportMigrationData.mockReset();
	mocks.exportMigrationData.mockResolvedValue(undefined);
});

it('uses the diagnostic native check and retains plugin update resources', async () => {
	mocks.invoke.mockResolvedValue({
		rid: 42,
		currentVersion: '2.4.0',
		version: '2.5.0',
		rawJson: {},
	});
	const update = await checkForUpdate('startup');
	expect(mocks.invoke).toHaveBeenCalledWith('check_for_update');
	expect(update?.version).toBe('2.5.0');
	expect(update?.rid).toBe(42);
	expect(typeof update?.downloadAndInstall).toBe('function');
	expect(updateStore.pendingUpdate).toBe(update);
	expect(mocks.handleError).not.toHaveBeenCalled();
});

it('handles no available update without reporting an error', async () => {
	mocks.invoke.mockResolvedValue(null);
	await expect(checkForUpdate()).resolves.toBeNull();
	expect(mocks.handleError).not.toHaveBeenCalled();
});

it('does not start update work or error telemetry while offline', async () => {
	const onlineDescriptor = Object.getOwnPropertyDescriptor(networkStatus, 'isOnline');
	const offlineDescriptor = Object.getOwnPropertyDescriptor(networkStatus, 'isOffline');
	Object.defineProperty(networkStatus, 'isOnline', { configurable: true, get: () => false });
	Object.defineProperty(networkStatus, 'isOffline', { configurable: true, get: () => true });
	try {
		const update = makeUpdate();
		updateStore.setCheckResult(update);
		await expect(checkForUpdate()).resolves.toBeNull();
		await expect(installPendingUpdate()).resolves.toBeUndefined();
		expect(mocks.invoke).not.toHaveBeenCalled();
		expect(mocks.exportMigrationData).not.toHaveBeenCalled();
		expect(update.downloadAndInstall).not.toHaveBeenCalled();
		expect(mocks.handleError).not.toHaveBeenCalled();
	} finally {
		if (onlineDescriptor) {
			Object.defineProperty(networkStatus, 'isOnline', onlineDescriptor);
		}
		if (offlineDescriptor) {
			Object.defineProperty(networkStatus, 'isOffline', offlineDescriptor);
		}
	}
});

it('reports native check details, trigger and elapsed time before propagating the error', async () => {
	const cause = {
		message: 'connection failed',
		code: 'connect',
		cause: { message: 'DNS failed' },
	};
	mocks.invoke.mockRejectedValue(cause);
	await expect(checkForUpdate('startup')).rejects.toMatchObject({ cause });
	expect(mocks.handleError).toHaveBeenCalledWith(
		'Update operation failed',
		expect.objectContaining({ cause }),
		{
			silent: true,
			context: {
				operation: 'updater',
				stage: 'check',
				trigger: 'startup',
				service: 'app_updates',
				duration_ms: expect.any(Number),
			},
		}
	);
});

it.each(['backup', 'download', 'install', 'relaunch'])(
	'reports the %s failure stage exactly once',
	async (stage) => {
		const update = makeUpdate();
		const error = new Error('failure');
		updateStore.setCheckResult(update);
		if (stage === 'backup') {
			mocks.exportMigrationData.mockRejectedValue(error);
		} else if (stage === 'relaunch') {
			mocks.relaunch.mockRejectedValue(error);
		} else {
			update.downloadAndInstall.mockImplementation(async (onEvent) => {
				if (stage === 'install') {
					onEvent({ event: 'Finished' });
				}
				throw error;
			});
		}
		await expect(installPendingUpdate()).rejects.toBe(error);
		expect(mocks.handleError).toHaveBeenCalledOnce();
		expect(mocks.handleError).toHaveBeenCalledWith(
			'Update operation failed',
			error,
			expect.objectContaining({
				context: expect.objectContaining({
					stage,
					operation: 'updater',
					duration_ms: expect.any(Number),
				}),
			})
		);
		if (stage !== 'relaunch') {
			expect(mocks.relaunch).not.toHaveBeenCalled();
		}
	}
);

it('exports migration data before installing a pending update', async () => {
	const update = makeUpdate();
	updateStore.setCheckResult(update);

	await installPendingUpdate();

	expect(mocks.exportMigrationData).toHaveBeenCalledWith(
		mocks.preferenceManager,
		mocks.bookmarkManager
	);
	expect(update.downloadAndInstall).toHaveBeenCalledOnce();
	expect(mocks.exportMigrationData.mock.invocationCallOrder[0]).toBeLessThan(
		update.downloadAndInstall.mock.invocationCallOrder[0]
	);
	expect(mocks.relaunch).toHaveBeenCalledOnce();
});

it('does not install the pending update when the migration export fails', async () => {
	const update = makeUpdate();
	const error = new Error('backup failed');
	updateStore.setCheckResult(update);
	mocks.exportMigrationData.mockRejectedValue(error);

	await expect(installPendingUpdate()).rejects.toThrow(error);

	expect(update.downloadAndInstall).not.toHaveBeenCalled();
	expect(mocks.relaunch).not.toHaveBeenCalled();
});
