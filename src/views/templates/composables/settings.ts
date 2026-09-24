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
	if (getPreferenceManager().get('beta') === checked) {
		return;
	}
	getPreferenceManager().set('beta', checked);
	telemetry.trackEvent('settings.changed', { setting: 'beta' }).catch(() => {});
};

export const updateToneColorsPreference = (data: ToneColorsPreference): void => {
	if (JSON.stringify(getPreferenceManager().get('toneColors')) === JSON.stringify(data)) {
		return;
	}
	// The picker reuses and mutates its array; keep the persisted comparison value independent.
	getPreferenceManager().set('toneColors', { ...data, colors: [...data.colors] });
	telemetry.trackEvent('settings.changed', { setting: 'toneColors' }).catch(() => {});
};

export const updateCharacterSetPreference = (characterSet: CharacterSet): void => {
	if (dictionaryDisplaySettingsStore.settings.characterSet === characterSet) {
		return;
	}
	dictionaryDisplaySettingsStore.setCharacterSet(characterSet);
	telemetry.trackEvent('settings.changed', { setting: 'characterSet' }).catch(() => {});
};

export const updateColorCharactersByTonePreference = (checked: boolean): void => {
	if (dictionaryDisplaySettingsStore.settings.colorCharactersByTone === checked) {
		return;
	}
	dictionaryDisplaySettingsStore.setColorCharactersByTone(checked);
	telemetry.trackEvent('settings.changed', { setting: 'colorCharactersByTone' }).catch(() => {});
};

export const updateColorPinyinByTonePreference = (checked: boolean): void => {
	if (dictionaryDisplaySettingsStore.settings.colorPinyinByTone === checked) {
		return;
	}
	dictionaryDisplaySettingsStore.setColorPinyinByTone(checked);
	telemetry.trackEvent('settings.changed', { setting: 'colorPinyinByTone' }).catch(() => {});
};

export const updateColorListsByTonePreference = (checked: boolean): void => {
	if (dictionaryDisplaySettingsStore.settings.colorListsByTone === checked) {
		return;
	}
	dictionaryDisplaySettingsStore.setColorListsByTone(checked);
	telemetry.trackEvent('settings.changed', { setting: 'colorListsByTone' }).catch(() => {});
};

export const updateHskVariantPreference = (variant: HskVariant): void => {
	if (dictionaryDisplaySettingsStore.settings.hskVariant === variant) {
		return;
	}
	dictionaryDisplaySettingsStore.setHskVariant(variant);
	telemetry.trackEvent('settings.changed', { setting: 'hskVariant' }).catch(() => {});
};

export const updateShowQualifiersPreference = (checked: boolean): void => {
	if (dictionaryDisplaySettingsStore.settings.showQualifiers === checked) {
		return;
	}
	dictionaryDisplaySettingsStore.setShowQualifiers(checked);
	telemetry.trackEvent('settings.changed', { setting: 'showQualifiers' }).catch(() => {});
};

export const updateShowPartsOfSpeechPreference = (checked: boolean): void => {
	if (dictionaryDisplaySettingsStore.settings.showPartsOfSpeech === checked) {
		return;
	}
	dictionaryDisplaySettingsStore.setShowPartsOfSpeech(checked);
	telemetry.trackEvent('settings.changed', { setting: 'showPartsOfSpeech' }).catch(() => {});
};

export const updateShowAlternativePronunciationsPreference = (checked: boolean): void => {
	if (dictionaryDisplaySettingsStore.settings.showAlternativePronunciations === checked) {
		return;
	}
	dictionaryDisplaySettingsStore.setShowAlternativePronunciations(checked);
	telemetry
		.trackEvent('settings.changed', { setting: 'showAlternativePronunciations' })
		.catch(() => {});
};

export const updateAgeStatus = async (isBelowApplicableAge: boolean): Promise<void> => {
	await privacySettingsStore.setChildPrivacyMode(isBelowApplicableAge);
};
