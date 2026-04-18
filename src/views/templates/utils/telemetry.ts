import { invoke } from '@tauri-apps/api/core';
import { version } from '@tauri-apps/plugin-os';

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
		return invoke('telemetry_init', { osVersion });
	},
	trackEvent: (name: string, payload: Record<string, unknown> = {}): Promise<void> =>
		invoke('telemetry_track_event', { name, payload }),
	trackScreen: (name: string, payload: Record<string, unknown> = {}): Promise<void> =>
		invoke('telemetry_track_screen', { name, payload }),
	trackError: (
		name: string,
		message: string,
		payload: Record<string, unknown> = {}
	): Promise<void> => invoke('telemetry_track_error', { name, message, payload }),
	getQueuedEvents: (limit = 50): Promise<TelemetryEvent[]> =>
		invoke('telemetry_get_queued_events', { limit }),
	getPrefs: (): Promise<TelemetryPrefs> => invoke('telemetry_get_prefs'),
	setPref: (key: string, value: boolean): Promise<void> =>
		invoke('telemetry_set_pref', { key, value }),
};
