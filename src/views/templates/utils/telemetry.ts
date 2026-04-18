import { invoke } from '@tauri-apps/api/core';
import { version } from '@tauri-apps/plugin-os';
import { NATIVE_COMMANDS } from '../types/nativeCommands.js';

export interface TelemetryPrefs {
	enabled: boolean;
	track_events: boolean;
	track_screen_views: boolean;
	track_errors: boolean;
	include_device_context: boolean;
}

export interface TelemetryEvent {
	id: string;
	family: string;
	name: string;
	timestamp_ms: number;
	[key: string]: unknown;
}

export const telemetry = {
	init: async (): Promise<void> => {
		let osVersion = '';
		try {
			osVersion = version();
		} catch {
			// noop
		}
		return invoke(NATIVE_COMMANDS.TELEMETRY.INIT, { osVersion });
	},
	trackEvent: (name: string, payload: Record<string, unknown> = {}): Promise<void> =>
		invoke(NATIVE_COMMANDS.TELEMETRY.TRACK_EVENT, { name, payload }),
	trackScreen: (name: string, payload: Record<string, unknown> = {}): Promise<void> =>
		invoke(NATIVE_COMMANDS.TELEMETRY.TRACK_SCREEN, { name, payload }),
	trackError: (
		name: string,
		message: string,
		payload: Record<string, unknown> = {}
	): Promise<void> => invoke(NATIVE_COMMANDS.TELEMETRY.TRACK_ERROR, { name, message, payload }),
	getQueuedEvents: (limit = 50): Promise<TelemetryEvent[]> =>
		invoke(NATIVE_COMMANDS.TELEMETRY.GET_QUEUED_EVENTS, { limit }),
	getPrefs: (): Promise<TelemetryPrefs> => invoke(NATIVE_COMMANDS.TELEMETRY.GET_PREFS),
	setPref: (key: string, value: boolean): Promise<void> =>
		invoke(NATIVE_COMMANDS.TELEMETRY.SET_PREF, { key, value }),
};
