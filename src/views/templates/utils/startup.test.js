import { beforeEach, expect, it, vi } from 'vitest';

vi.mock('elastic-scroll-polyfill', () => ({
	default: vi.fn(),
}));

vi.mock('@/stores/bookmarks.svelte.js', () => ({
	bookmarksStore: {
		refresh: vi.fn(),
	},
}));

vi.mock('@/stores/readerDocuments.svelte.js', () => ({
	readerDocumentsStore: {
		refresh: vi.fn(),
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
import { shouldRunStartupUpdateCheck } from '@/utils/startup.js';

beforeEach(() => {
	vi.clearAllMocks();
	vi.mocked(isMobile).mockReturnValue(false);
	vi.mocked(resolveIsMasBuild).mockResolvedValue(false);
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
