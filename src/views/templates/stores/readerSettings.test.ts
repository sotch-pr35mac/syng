import { beforeEach, expect, it, vi } from 'vitest';

let readerSettingsStore: typeof import('@/stores/readerSettings.svelte.js').readerSettingsStore;
let setPreferenceManagerForTest: typeof import('@/utils/appServices.js').setPreferenceManagerForTest;
type PreferenceManagerForTest = Parameters<typeof setPreferenceManagerForTest>[0];
const MIN_FONT_SIZE_PERCENT = 50;
const MIN_FONT_SIZE_NEXT_STEP_PERCENT = 60;
const MAX_FONT_SIZE_PERCENT = 150;
const TEST_FONT_SIZE_PERCENT = 120;

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

it('defaults to automatic reader theme', () => {
	expect(readerSettingsStore.settings.colorTheme).toBe('automatic');
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
	expect(readerSettingsStore.settings.fontSizePercent).toBe(MAX_FONT_SIZE_PERCENT);
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

it('persists automatic as the active color theme', () => {
	const preferenceManager = buildPreferenceManager();
	setPreferenceManagerForTest(preferenceManager as unknown as PreferenceManagerForTest);

	readerSettingsStore.applyColorTheme('automatic');

	expect(readerSettingsStore.settings.colorTheme).toBe('automatic');
	expect(preferenceManager.set).toHaveBeenCalledWith(
		'readerSettings',
		expect.objectContaining({
			colorTheme: 'automatic',
		})
	);
});

it('changes font size in bounded steps', () => {
	const preferenceManager = buildPreferenceManager();
	setPreferenceManagerForTest(preferenceManager as unknown as PreferenceManagerForTest);

	readerSettingsStore.setFontSizePercent(MIN_FONT_SIZE_PERCENT);
	readerSettingsStore.decreaseFontSize();
	expect(readerSettingsStore.settings.fontSizePercent).toBe(MIN_FONT_SIZE_PERCENT);

	readerSettingsStore.increaseFontSize();
	expect(readerSettingsStore.settings.fontSizePercent).toBe(MIN_FONT_SIZE_NEXT_STEP_PERCENT);

	readerSettingsStore.setFontSizePercent(MAX_FONT_SIZE_PERCENT);
	readerSettingsStore.increaseFontSize();
	expect(readerSettingsStore.settings.fontSizePercent).toBe(MAX_FONT_SIZE_PERCENT);
});

it('persists font size changes', () => {
	const preferenceManager = buildPreferenceManager();
	setPreferenceManagerForTest(preferenceManager as unknown as PreferenceManagerForTest);

	readerSettingsStore.setFontSizePercent(TEST_FONT_SIZE_PERCENT);

	expect(preferenceManager.set).toHaveBeenCalledWith(
		'readerSettings',
		expect.objectContaining({
			fontSizePercent: TEST_FONT_SIZE_PERCENT,
		})
	);
});
