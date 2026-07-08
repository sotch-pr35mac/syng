import { beforeEach, expect, it, vi } from 'vitest';
import type { Update } from '@tauri-apps/plugin-updater';

const mocks = vi.hoisted(() => ({
	check: vi.fn(),
	relaunch: vi.fn(),
	exportMigrationData: vi.fn(),
	preferenceManager: {},
	bookmarkManager: {},
	readerDocumentManager: {},
}));

vi.mock('@tauri-apps/plugin-updater', () => ({
	check: mocks.check,
}));

vi.mock('@tauri-apps/plugin-process', () => ({
	relaunch: mocks.relaunch,
}));

vi.mock('@/utils/appServices.js', () => ({
	getPreferenceManager: vi.fn(() => mocks.preferenceManager),
	getBookmarkManager: vi.fn(() => mocks.bookmarkManager),
	getReaderDocumentManager: vi.fn(() => mocks.readerDocumentManager),
}));

vi.mock('@/utils/migrationManager.js', () => ({
	exportMigrationData: mocks.exportMigrationData,
}));

import { updateStore } from '@/stores/update.svelte.js';
import { installPendingUpdate } from '@/utils/updateManager.js';

const makeUpdate = () =>
	({
		version: '2.0.1',
		body: '',
		downloadAndInstall: vi.fn(() => Promise.resolve()),
	}) as unknown as Update & { downloadAndInstall: ReturnType<typeof vi.fn> };

beforeEach(() => {
	updateStore.resetStatus();
	mocks.check.mockReset();
	mocks.relaunch.mockReset();
	mocks.relaunch.mockResolvedValue(undefined);
	mocks.exportMigrationData.mockReset();
	mocks.exportMigrationData.mockResolvedValue(undefined);
});

it('exports migration data before installing a pending update', async () => {
	const update = makeUpdate();
	updateStore.setCheckResult(update);

	await installPendingUpdate();

	expect(mocks.exportMigrationData).toHaveBeenCalledWith(
		mocks.preferenceManager,
		mocks.bookmarkManager,
		mocks.readerDocumentManager
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
