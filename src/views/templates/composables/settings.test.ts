import { beforeEach, expect, it, vi } from 'vitest';
import {
	isDevBuild,
	resolveIsDevBuild,
	updateBetaPreference,
	updateCharacterSetPreference,
	updateColorCharactersByTonePreference,
	updateColorListsByTonePreference,
	updateColorPinyinByTonePreference,
	updateToneColorsPreference,
	updateAgeStatus,
} from '@/composables/settings.js';
import { telemetry } from '@/utils/telemetry.js';
import { invoke } from '@tauri-apps/api/core';
import { setPreferenceManagerForTest } from '@/utils/appServices.js';
import { privacySettingsStore } from '@/stores/privacySettings.svelte.js';

vi.mock('@tauri-apps/api/core', () => ({
	invoke: vi.fn(),
}));

vi.mock('@/utils/telemetry.js', () => ({
	telemetry: {
		trackEvent: vi.fn(() => Promise.resolve()),
		setPref: vi.fn(() => Promise.resolve()),
	},
}));

let preferenceManager;

beforeEach(() => {
	preferenceManager = {
		get: vi.fn(),
		set: vi.fn(),
	};
	setPreferenceManagerForTest(preferenceManager);
	vi.mocked(telemetry.trackEvent).mockClear();
	vi.mocked(telemetry.setPref).mockClear();
	vi.mocked(invoke).mockReset();
	privacySettingsStore.setPrivacySettingsForTest({
		childPrivacyMode: false,
		completedOnboardingVersion: 0,
	});
});

it('detects dev build state from the provided environment', () => {
	expect(isDevBuild({ DEV: true })).toBe(true);
	expect(isDevBuild({ MODE: 'development' })).toBe(true);
	expect(isDevBuild({ DEV: false })).toBe(false);
});

it('resolves dev build state from the provided environment without runtime debug lookup', async () => {
	await expect(resolveIsDevBuild({ DEV: true })).resolves.toBe(true);
	expect(invoke).not.toHaveBeenCalled();
});

it('resolves dev build state from the native build flag', async () => {
	vi.mocked(invoke).mockResolvedValueOnce(true);

	await expect(resolveIsDevBuild({ DEV: false })).resolves.toBe(true);
	expect(invoke).toHaveBeenCalledWith('is_dev_build');
});

it('updates the beta preference and tracks the settings event', () => {
	updateBetaPreference(true);

	expect(preferenceManager.set).toHaveBeenCalledWith('beta', true);
	expect(telemetry.trackEvent).toHaveBeenCalledWith('settings.changed', { setting: 'beta' });
});

it('updates the tone colors preference and tracks the settings event', () => {
	const colors = {
		hasCustomColors: true,
		colors: ['#111111', '#222222'],
	};

	updateToneColorsPreference(colors);

	expect(preferenceManager.set).toHaveBeenCalledWith('toneColors', colors);
	expect(telemetry.trackEvent).toHaveBeenCalledWith('settings.changed', {
		setting: 'toneColors',
	});
});

it.each([
	{
		update: () => updateCharacterSetPreference('traditional'),
		key: 'characterSet',
		value: 'traditional',
	},
	{
		update: () => updateColorCharactersByTonePreference(false),
		key: 'colorCharactersByTone',
		value: false,
	},
	{
		update: () => updateColorPinyinByTonePreference(true),
		key: 'colorPinyinByTone',
		value: true,
	},
	{
		update: () => updateColorListsByTonePreference(true),
		key: 'colorListsByTone',
		value: true,
	},
])('updates and tracks the $key display preference', ({ update, key, value }) => {
	update();

	expect(preferenceManager.set).toHaveBeenCalledWith(key, value);
	expect(telemetry.trackEvent).toHaveBeenCalledWith('settings.changed', { setting: key });
	expect(preferenceManager.set).not.toHaveBeenCalledWith('toneColors', expect.anything());
});

it('classifies age status into child privacy mode and restores telemetry when leaving', async () => {
	await updateAgeStatus(true);

	expect(preferenceManager.set).toHaveBeenCalledWith('childPrivacyMode', true);
	expect(telemetry.setPref).toHaveBeenCalledWith('enabled', false);

	await updateAgeStatus(false);

	expect(preferenceManager.set).toHaveBeenCalledWith('childPrivacyMode', false);
	expect(telemetry.setPref).toHaveBeenCalledWith('enabled', true);
});
