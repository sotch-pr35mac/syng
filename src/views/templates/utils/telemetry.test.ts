import { expect, it } from 'vitest';
import { exampleTelemetryEnvelopes, type TelemetryPrefs } from '@/utils/telemetry.js';

const allEnabled: TelemetryPrefs = {
	enabled: true,
	track_events: true,
	track_screen_views: true,
	track_errors: true,
	include_device_context: true,
};

it('returns no envelopes when telemetry is disabled', () => {
	expect(exampleTelemetryEnvelopes({ ...allEnabled, enabled: false })).toEqual([]);
});

it('includes only enabled categories and adds device context when that preference is on', () => {
	const withContext = exampleTelemetryEnvelopes(allEnabled);
	expect(withContext.map((envelope) => envelope.family)).toEqual([
		'event',
		'screen_view',
		'error',
	]);
	expect(withContext[0]?.device_context).toEqual({
		arch: 'aarch64',
		os_version: '15.0',
		timezone: 'Etc/UTC',
	});

	const withoutContext = exampleTelemetryEnvelopes({
		...allEnabled,
		include_device_context: false,
		track_errors: false,
	});
	expect(withoutContext.map((envelope) => envelope.family)).toEqual(['event', 'screen_view']);
	expect(withoutContext[0]?.device_context).toBeUndefined();
	expect(JSON.stringify(withoutContext)).not.toMatch(/search query|birthday|region/i);
});
