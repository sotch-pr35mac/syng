import { telemetry } from '../utils/telemetry.js';
import { invoke } from '@tauri-apps/api/core';
import { NATIVE_COMMANDS } from '../types/nativeCommands.js';

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

export const updateBetaPreference = (checked: boolean): void => {
	window.preferenceManager.set('beta', checked);
	telemetry.trackEvent('settings.changed', { setting: 'beta' }).catch(() => {});
};

export const updateToneColorsPreference = (data: ToneColorsPreference): void => {
	window.preferenceManager.set('toneColors', data);
	telemetry.trackEvent('settings.changed', { setting: 'toneColors' }).catch(() => {});
};
