import { telemetry } from '@/utils/telemetry.js';
import { invoke } from '@tauri-apps/api/core';
import { NATIVE_COMMANDS } from '@/types/nativeCommands.js';
import { getPreferenceManager } from '@/utils/appServices.js';
import { dictionaryDisplaySettingsStore } from '@/stores/dictionaryDisplaySettings.svelte.js';
import { privacySettingsStore } from '@/stores/privacySettings.svelte.js';
import type { CharacterSet, HskVariant } from '@/types/dictionaryDisplay.js';

interface BuildEnv {
	DEV?: boolean;
	MODE?: string;
}

interface ToneColorsPreference {
	hasCustomColors: boolean;
	colors: string[];
}

const currentBuildEnv = (): BuildEnv => (import.meta as ImportMeta & { env?: BuildEnv }).env ?? {};

export const isDevBuild = (env: BuildEnv = currentBuildEnv()): boolean =>
	Boolean(env.DEV) || env.MODE === 'development';

export const resolveIsDevBuild = async (env: BuildEnv = currentBuildEnv()): Promise<boolean> => {
	if (isDevBuild(env)) {
		return true;
	}

	return invoke<boolean>(NATIVE_COMMANDS.APP.IS_DEV_BUILD).catch(() => false);
};

/**
 * Whether this is a Mac App Store build. MAS builds ship without the self-updater (Apple forbids
 * self-updating apps), so the Updates preference is hidden. Defaults to false if the command is
 * unavailable (e.g. non-desktop platforms).
 */
export const resolveIsMasBuild = async (): Promise<boolean> =>
	invoke<boolean>(NATIVE_COMMANDS.APP.IS_MAS_BUILD).catch(() => false);

export const updateBetaPreference = (checked: boolean): void => {
	getPreferenceManager().set('beta', checked);
	telemetry.trackEvent('settings.changed', { setting: 'beta' }).catch(() => {});
};

export const updateToneColorsPreference = (data: ToneColorsPreference): void => {
	getPreferenceManager().set('toneColors', data);
	telemetry.trackEvent('settings.changed', { setting: 'toneColors' }).catch(() => {});
};

export const updateCharacterSetPreference = (characterSet: CharacterSet): void => {
	dictionaryDisplaySettingsStore.setCharacterSet(characterSet);
	telemetry.trackEvent('settings.changed', { setting: 'characterSet' }).catch(() => {});
};

export const updateColorCharactersByTonePreference = (checked: boolean): void => {
	dictionaryDisplaySettingsStore.setColorCharactersByTone(checked);
	telemetry.trackEvent('settings.changed', { setting: 'colorCharactersByTone' }).catch(() => {});
};

export const updateColorPinyinByTonePreference = (checked: boolean): void => {
	dictionaryDisplaySettingsStore.setColorPinyinByTone(checked);
	telemetry.trackEvent('settings.changed', { setting: 'colorPinyinByTone' }).catch(() => {});
};

export const updateColorListsByTonePreference = (checked: boolean): void => {
	dictionaryDisplaySettingsStore.setColorListsByTone(checked);
	telemetry.trackEvent('settings.changed', { setting: 'colorListsByTone' }).catch(() => {});
};

export const updateHskVariantPreference = (variant: HskVariant): void => {
	dictionaryDisplaySettingsStore.setHskVariant(variant);
	telemetry.trackEvent('settings.changed', { setting: 'hskVariant' }).catch(() => {});
};

export const updateAgeStatus = async (isBelowApplicableAge: boolean): Promise<void> => {
	await privacySettingsStore.setChildPrivacyMode(isBelowApplicableAge);
};
