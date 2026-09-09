import { beforeEach, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import {
	filterRegionOptions,
	loadRegionOptions,
	regionNameFor,
	resetRegionOptionsForTest,
} from '@/utils/regions.js';
import { NATIVE_COMMANDS } from '@/types/nativeCommands.js';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

beforeEach(() => {
	resetRegionOptionsForTest();
	vi.mocked(invoke).mockReset();
	vi.mocked(invoke).mockResolvedValue([
		{ code: 'US', fallbackName: 'United States of America' },
		{ code: 'JP', fallbackName: 'Japan' },
	]);
});

it('loads ISO regions once and localizes their display names', async () => {
	const first = await loadRegionOptions('en');
	const second = await loadRegionOptions('en');

	expect(invoke).toHaveBeenCalledOnce();
	expect(invoke).toHaveBeenCalledWith(NATIVE_COMMANDS.APP.GET_REGION_OPTIONS);
	expect(first).toBe(second);
	expect(regionNameFor(first, 'us')).toBe('United States');
});

it('filters loaded regions by localized name or code', async () => {
	const regions = await loadRegionOptions('en');

	expect(filterRegionOptions(regions, 'united').map((region) => region.code)).toEqual(['US']);
	expect(filterRegionOptions(regions, 'JP').map((region) => region.code)).toEqual(['JP']);
});

it('allows retrying after a native load failure', async () => {
	vi.mocked(invoke).mockRejectedValueOnce(new Error('not ready'));

	await expect(loadRegionOptions('en')).rejects.toThrow('not ready');
	await expect(loadRegionOptions('en')).resolves.toHaveLength(2);
	expect(invoke).toHaveBeenCalledTimes(2);
});
