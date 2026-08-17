import { beforeEach, expect, it, vi } from 'vitest';

let dictionaryDisplaySettingsStore: typeof import('@/stores/dictionaryDisplaySettings.svelte.js').dictionaryDisplaySettingsStore;
let setPreferenceManagerForTest: typeof import('@/utils/appServices.js').setPreferenceManagerForTest;
type PreferenceManagerForTest = Parameters<typeof setPreferenceManagerForTest>[0];

const buildPreferenceManager = (preferences: Record<string, unknown> = {}) => ({
	waitForInit: vi.fn(() => Promise.resolve()),
	get: vi.fn((name: string) => preferences[name]),
	set: vi.fn(),
});

beforeEach(async () => {
	vi.resetModules();
	({ setPreferenceManagerForTest } = await import('@/utils/appServices.js'));
	({ dictionaryDisplaySettingsStore } =
		await import('@/stores/dictionaryDisplaySettings.svelte.js'));
});

it('starts with compatibility-preserving defaults', () => {
	expect(dictionaryDisplaySettingsStore.settings).toEqual({
		characterSet: 'both',
		colorCharactersByTone: true,
		colorPinyinByTone: false,
		colorListsByTone: false,
	});
});

it('loads persisted settings', async () => {
	const preferenceManager = buildPreferenceManager({
		characterSet: 'traditional',
		colorCharactersByTone: false,
		colorPinyinByTone: true,
		colorListsByTone: true,
	});
	setPreferenceManagerForTest(preferenceManager as unknown as PreferenceManagerForTest);

	await dictionaryDisplaySettingsStore.loadSettings();

	expect(dictionaryDisplaySettingsStore.settings).toEqual({
		characterSet: 'traditional',
		colorCharactersByTone: false,
		colorPinyinByTone: true,
		colorListsByTone: true,
	});
});

it('normalizes missing or invalid persisted values to defaults', async () => {
	const preferenceManager = buildPreferenceManager({
		characterSet: 'invalid',
		colorCharactersByTone: 'yes',
	});
	setPreferenceManagerForTest(preferenceManager as unknown as PreferenceManagerForTest);

	await dictionaryDisplaySettingsStore.loadSettings();

	expect(dictionaryDisplaySettingsStore.settings).toEqual({
		characterSet: 'both',
		colorCharactersByTone: true,
		colorPinyinByTone: false,
		colorListsByTone: false,
	});
});

it('updates reactive state and persists each preference independently', () => {
	const preferenceManager = buildPreferenceManager();
	setPreferenceManagerForTest(preferenceManager as unknown as PreferenceManagerForTest);

	dictionaryDisplaySettingsStore.setCharacterSet('simplified');
	dictionaryDisplaySettingsStore.setColorCharactersByTone(false);
	dictionaryDisplaySettingsStore.setColorPinyinByTone(true);
	dictionaryDisplaySettingsStore.setColorListsByTone(true);

	expect(dictionaryDisplaySettingsStore.settings).toEqual({
		characterSet: 'simplified',
		colorCharactersByTone: false,
		colorPinyinByTone: true,
		colorListsByTone: true,
	});
	expect(preferenceManager.set.mock.calls).toEqual([
		['characterSet', 'simplified'],
		['colorCharactersByTone', false],
		['colorPinyinByTone', true],
		['colorListsByTone', true],
	]);
	expect(preferenceManager.set).not.toHaveBeenCalledWith('toneColors', expect.anything());
});
