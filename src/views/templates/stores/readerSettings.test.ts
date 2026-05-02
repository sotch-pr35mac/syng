import { beforeEach, expect, it, vi } from 'vitest';

let readerSettingsStore: typeof import('@/stores/readerSettings.svelte.js').readerSettingsStore;
let setPreferenceManagerForTest: typeof import('@/utils/appServices.js').setPreferenceManagerForTest;
type PreferenceManagerForTest = Parameters<typeof setPreferenceManagerForTest>[0];

const buildPreferenceManager = (readerSettings?: Record<string, unknown>) => ({
	waitForInit: vi.fn(() => Promise.resolve()),
	get: vi.fn(() => readerSettings),
	set: vi.fn(),
});

beforeEach(async () => {
	vi.resetModules();
	({ setPreferenceManagerForTest } = await import('@/utils/appServices.js'));
	({ readerSettingsStore } = await import('@/stores/readerSettings.svelte.js'));
});

it('loads persisted reader settings and clamps the font size', async () => {
	const preferenceManager = buildPreferenceManager({
		colorTheme: 'dark',
		fontSizePercent: 999,
	});
	setPreferenceManagerForTest(preferenceManager as unknown as PreferenceManagerForTest);

	await readerSettingsStore.loadSettings();

	expect(readerSettingsStore.settings.colorTheme).toBe('dark');
	expect(readerSettingsStore.settings.backgroundColor).toBe('#111111');
	expect(readerSettingsStore.settings.textColor).toBe('#f5f5f5');
	expect(readerSettingsStore.settings.fontSizePercent).toBe(140);
});

it('updates and persists the active color theme', () => {
	const preferenceManager = buildPreferenceManager();
	setPreferenceManagerForTest(preferenceManager as unknown as PreferenceManagerForTest);

	readerSettingsStore.applyColorTheme('sepia');

	expect(readerSettingsStore.settings.colorTheme).toBe('sepia');
	expect(readerSettingsStore.settings.backgroundColor).toBe('#f4ecd8');
	expect(readerSettingsStore.settings.textColor).toBe('#4a3322');
	expect(preferenceManager.set).toHaveBeenCalledWith(
		'readerSettings',
		expect.objectContaining({
			colorTheme: 'sepia',
			backgroundColor: '#f4ecd8',
			textColor: '#4a3322',
		})
	);
});

it('changes font size in bounded steps', () => {
	const preferenceManager = buildPreferenceManager();
	setPreferenceManagerForTest(preferenceManager as unknown as PreferenceManagerForTest);

	readerSettingsStore.setFontSizePercent(80);
	readerSettingsStore.decreaseFontSize();
	expect(readerSettingsStore.settings.fontSizePercent).toBe(80);

	readerSettingsStore.increaseFontSize();
	expect(readerSettingsStore.settings.fontSizePercent).toBe(90);

	readerSettingsStore.setFontSizePercent(140);
	readerSettingsStore.increaseFontSize();
	expect(readerSettingsStore.settings.fontSizePercent).toBe(140);
});
