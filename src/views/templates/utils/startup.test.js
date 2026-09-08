import { beforeEach, expect, it, vi } from 'vitest';

vi.mock('elastic-scroll-polyfill', () => ({
	default: vi.fn(),
}));

vi.mock('@/stores/bookmarks.svelte.js', () => ({
	bookmarksStore: {
		refresh: vi.fn().mockResolvedValue(undefined),
	},
}));

vi.mock('@/stores/readerDocuments.svelte.js', () => ({
	readerDocumentsStore: {
		refresh: vi.fn().mockResolvedValue(undefined),
	},
}));

vi.mock('@/stores/dictionaryDisplaySettings.svelte.js', () => ({
	dictionaryDisplaySettingsStore: {
		loadSettings: vi.fn().mockResolvedValue(undefined),
	},
}));

vi.mock('@/utils/error.js', () => ({
	handleError: vi.fn(),
}));

vi.mock('@/utils/migrationManager.js', () => ({
	checkAndPerformMigration: vi.fn(),
	exportMigrationData: vi.fn(),
	setupShutdownHook: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({
	invoke: vi.fn(),
}));

vi.mock('@/utils/updateManager.js', () => ({
	checkForUpdate: vi.fn(),
}));

vi.mock('@/utils/device.js', () => ({
	isMobile: vi.fn(),
}));

vi.mock('@/types/nativeCommands.js', () => ({
	NATIVE_COMMANDS: {
		DICTIONARY: {
			INIT: 'init_dictionary',
		},
	},
}));

vi.mock('@/utils/telemetry.js', () => ({
	telemetry: {
		init: vi.fn(),
		trackEvent: vi.fn(),
	},
}));

vi.mock('@/utils/appServices.js', () => ({
	createAppServices: vi.fn(),
}));

vi.mock('@/composables/settings.js', () => ({
	resolveIsMasBuild: vi.fn(),
}));

import { resolveIsMasBuild } from '@/composables/settings.js';
import { isMobile } from '@/utils/device.js';
import { createAppServices } from '@/utils/appServices.js';
import {
	checkAndPerformMigration,
	exportMigrationData,
	setupShutdownHook,
} from '@/utils/migrationManager.js';
import { dictionaryDisplaySettingsStore } from '@/stores/dictionaryDisplaySettings.svelte.js';
import { databaseMigrationStore } from '@/stores/databaseMigration.svelte.js';
import { runStartupActions, shouldRunStartupUpdateCheck } from '@/utils/startup.js';
import { telemetry } from '@/utils/telemetry.js';

beforeEach(() => {
	vi.clearAllMocks();
	vi.mocked(isMobile).mockReturnValue(false);
	vi.mocked(resolveIsMasBuild).mockResolvedValue(false);
	vi.mocked(checkAndPerformMigration).mockResolvedValue(false);
	vi.mocked(exportMigrationData).mockResolvedValue(undefined);
	vi.mocked(setupShutdownHook).mockResolvedValue(undefined);
	vi.mocked(dictionaryDisplaySettingsStore.loadSettings).mockResolvedValue(undefined);
	vi.mocked(telemetry.init).mockResolvedValue(undefined);
	vi.mocked(telemetry.trackEvent).mockResolvedValue(undefined);
	databaseMigrationStore.resetForTest();
});

it('skips startup update checks on mobile hardware, including iPad', async () => {
	vi.mocked(isMobile).mockReturnValue(true);

	await expect(shouldRunStartupUpdateCheck()).resolves.toBe(false);
	expect(resolveIsMasBuild).not.toHaveBeenCalled();
});

it('skips startup update checks for Mac App Store builds', async () => {
	vi.mocked(resolveIsMasBuild).mockResolvedValue(true);

	await expect(shouldRunStartupUpdateCheck()).resolves.toBe(false);
	expect(resolveIsMasBuild).toHaveBeenCalledOnce();
});

it('runs startup update checks for non-store desktop builds', async () => {
	await expect(shouldRunStartupUpdateCheck()).resolves.toBe(true);
	expect(resolveIsMasBuild).toHaveBeenCalledOnce();
});

function startupServices(overrides = {}) {
	const preferenceManager = {
		init: vi.fn().mockResolvedValue(undefined),
		get: vi.fn().mockReturnValue({ hasCustomColors: false, colors: [] }),
	};
	const bookmarkManager = {
		init: vi.fn().mockResolvedValue(undefined),
		prepareSchema: vi.fn().mockResolvedValue(false),
	};
	const readerDocumentManager = { init: vi.fn().mockResolvedValue(undefined) };
	Object.assign(bookmarkManager, overrides);
	vi.mocked(createAppServices).mockReturnValue({
		preferenceManager,
		bookmarkManager,
		readerDocumentManager,
	});
	return { preferenceManager, bookmarkManager, readerDocumentManager };
}

it('restores storage before preparing the bookmark schema and starts the app afterward', async () => {
	const order = [];
	const { bookmarkManager } = startupServices({
		prepareSchema: vi.fn(async (onStart) => {
			order.push('schema');
			onStart();
			return true;
		}),
	});
	vi.mocked(checkAndPerformMigration).mockImplementation(async () => {
		order.push('restore');
		return true;
	});
	vi.mocked(exportMigrationData).mockImplementation(async () => {
		order.push('backup');
	});
	const initialized = vi.fn(() => order.push('init-event'));
	document.addEventListener('init', initialized, { once: true });

	await runStartupActions();

	expect(order).toEqual(['restore', 'schema', 'backup', 'init-event']);
	expect(bookmarkManager.prepareSchema).toHaveBeenCalledOnce();
	expect(databaseMigrationStore.status).toBe('idle');
});

it('does not show migration UI when the current schema requires no work', async () => {
	const { bookmarkManager } = startupServices();
	await runStartupActions();

	expect(bookmarkManager.prepareSchema).toHaveBeenCalledOnce();
	expect(databaseMigrationStore.active).toBe(false);
});

it('retains the migration error and stops startup backup and init on failure', async () => {
	startupServices({
		prepareSchema: vi.fn(async (onStart) => {
			onStart();
			throw new Error('write failed');
		}),
	});
	const initialized = vi.fn();
	document.addEventListener('init', initialized, { once: true });

	await runStartupActions();

	expect(databaseMigrationStore.status).toBe('failed');
	expect(databaseMigrationStore.errorMessage).toContain('No schema version was saved');
	expect(setupShutdownHook).not.toHaveBeenCalled();
	expect(exportMigrationData).not.toHaveBeenCalled();
	expect(initialized).not.toHaveBeenCalled();
});
