import { beforeEach, expect, it, vi } from 'vitest';
import { setPreferenceManagerForTest } from '@/utils/appServices.js';
import { pinyinSettingsStore } from '@/stores/pinyinSettings.svelte.js';
import { readerSettingsStore } from '@/stores/readerSettings.svelte.js';
import { emitTo } from '@tauri-apps/api/event';

vi.mock('@tauri-apps/api/event', () => ({ emitTo: vi.fn().mockResolvedValue(undefined) }));
let saved: Record<string, unknown>;
beforeEach(async () => {
	saved = {};
	setPreferenceManagerForTest({
		waitForInit: async () => undefined,
		get: (key: string) => saved[key],
		set: (key: string, value: unknown) => {
			saved[key] = value;
		},
	} as unknown as Parameters<typeof setPreferenceManagerForTest>[0]);
	await pinyinSettingsStore.loadSettings();
	await readerSettingsStore.loadSettings();
	vi.clearAllMocks();
});

it('defaults off and persists independent choices across reloads', async () => {
	expect(pinyinSettingsStore.showCharacterPinyin).toBe(false);
	expect(pinyinSettingsStore.showFlashcardPinyin).toBe(false);
	expect(readerSettingsStore.settings.showPinyin).toBe(false);
	pinyinSettingsStore.setCharacterPinyin(true);
	readerSettingsStore.setShowPinyin(true);
	await pinyinSettingsStore.loadSettings();
	await readerSettingsStore.loadSettings();
	expect(pinyinSettingsStore.showCharacterPinyin).toBe(true);
	expect(pinyinSettingsStore.showFlashcardPinyin).toBe(false);
	expect(readerSettingsStore.settings.showPinyin).toBe(true);
	expect(emitTo).toHaveBeenCalledWith('characters', 'character-display-settings-changed', {
		showPinyin: true,
	});
});

it('does not let delayed loading undo a newer user choice', async () => {
	let finish!: () => void;
	setPreferenceManagerForTest({
		waitForInit: () =>
			new Promise<void>((resolve) => {
				finish = resolve;
			}),
		get: () => false,
		set: vi.fn(),
	} as unknown as Parameters<typeof setPreferenceManagerForTest>[0]);
	const loading = pinyinSettingsStore.loadSettings();
	pinyinSettingsStore.setFlashcardPinyin(true);
	finish();
	await loading;
	expect(pinyinSettingsStore.showFlashcardPinyin).toBe(true);
});

it('normalizes old Reader settings and retains unrelated choices when toggled', async () => {
	saved.readerSettings = { colorTheme: 'sepia', fontSizePercent: 130, showPinyin: 'yes' };
	await readerSettingsStore.loadSettings();
	expect(readerSettingsStore.settings.showPinyin).toBe(false);
	readerSettingsStore.setShowPinyin(true);
	expect(saved.readerSettings).toMatchObject({
		colorTheme: 'sepia',
		fontSizePercent: 130,
		showPinyin: true,
	});
});
