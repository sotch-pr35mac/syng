import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { exampleTelemetryEnvelopes, type TelemetryPrefs } from '@/utils/telemetry.js';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/plugin-os', () => ({ version: () => '15.0' }));

let telemetryModule: typeof import('@/utils/telemetry.js');
beforeEach(async () => {
	vi.useFakeTimers();
	vi.resetModules();
	vi.mocked(invoke).mockReset();
	vi.mocked(invoke).mockImplementation(async (command) =>
		command === 'telemetry_get_prefs' ? allEnabled : undefined
	);
	telemetryModule = await import('@/utils/telemetry.js');
});
afterEach(() => {
	telemetryModule.flushTelemetrySummaries();
	vi.useRealTimers();
});

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

it('holds early events until initialization and persisted preferences are ready', async () => {
	let finishInit!: () => void;
	vi.mocked(invoke).mockImplementation((command) => {
		if (command === 'telemetry_init') {
			return new Promise<void>((resolve) => {
				finishInit = resolve;
			});
		}
		return Promise.resolve(command === 'telemetry_get_prefs' ? allEnabled : undefined);
	});
	const initialized = telemetryModule.telemetry.init();
	expect(telemetryModule.telemetry.init()).toBe(initialized);
	const event = telemetryModule.telemetry.trackEvent('onboarding.started');
	const screen = telemetryModule.telemetry.trackScreen('search');
	expect(invoke).toHaveBeenCalledTimes(1);
	finishInit();
	await Promise.all([initialized, event, screen]);
	expect(vi.mocked(invoke).mock.calls.map(([command]) => command)).toEqual([
		'telemetry_init',
		'telemetry_get_prefs',
		'telemetry_track_event',
		'telemetry_track_screen',
	]);
});

it('does not recursively report initialization or bridge failures', async () => {
	vi.mocked(invoke).mockRejectedValue(new Error('bridge unavailable'));
	await expect(telemetryModule.telemetry.init()).rejects.toThrow('bridge unavailable');
	await expect(telemetryModule.telemetry.trackError('app.error', 'failure')).rejects.toThrow(
		'bridge unavailable'
	);
	expect(invoke).toHaveBeenCalledTimes(1);
});

it('redacts known user content, credentials, paths and URLs without transmitting object dumps', async () => {
	await telemetryModule.telemetry.trackError('app.error', 'Cannot open My Secret List', {
		operation: 'getListContent',
		error_message: 'My Secret List password=hunter2 Bearer abc.def',
		error_stack:
			'Error: failed\n at load (/Users/alice/private.txt:2:3)\n at fetch (https://example.test/private?q=secret)',
		error_payload: JSON.stringify({
			list: 'My Secret List',
			nested: { notes: 'personal notes' },
		}),
		query: '你好',
		lexical_id: '1:secret-entry',
		nested: { token: 'abc.def' },
		ms_since_foreground: 25,
	});
	const sent = JSON.stringify(vi.mocked(invoke).mock.calls);
	expect(sent).not.toMatch(
		/My Secret List|hunter2|abc\.def|alice|example\.test|你好|secret-entry|personal notes|error_payload/
	);
	expect(sent).toContain('getListContent');
	expect(sent).toContain('at load');
	expect(sent).toContain('ms_since_foreground');
});

it('handles cyclic objects and Windows paths while keeping diagnostic codes', () => {
	const payload: Record<string, unknown> = {
		code: 'DB_CLOSED',
		error_message: 'C:\\Users\\Alice\\private.db',
	};
	payload.self = payload;
	expect(telemetryModule.sanitizeDiagnostics('Failed', payload)).toEqual({
		message: 'Failed',
		payload: { code: 'DB_CLOSED', error_message: '[redacted path]' },
	});
});

it('emits the first error immediately and a counted summary for repeats', async () => {
	for (let occurrence = 0; occurrence < 4; occurrence += 1) {
		await telemetryModule.telemetry.trackError('app.error', 'Database closed', {
			operation: 'read',
		});
	}
	expect(invoke).toHaveBeenCalledTimes(1);
	await vi.advanceTimersByTimeAsync(30_000);
	expect(invoke).toHaveBeenCalledTimes(2);
	expect(invoke).toHaveBeenLastCalledWith(
		'telemetry_track_error',
		expect.objectContaining({
			payload: { operation: 'read', occurrence_count: 3, summary: true },
		})
	);
	await telemetryModule.telemetry.trackError('app.error', 'Database closed', {
		operation: 'read',
	});
	expect(invoke).toHaveBeenCalledTimes(3);
});

it('flushes error repeats on background and does not combine different operations', async () => {
	await telemetryModule.telemetry.init();
	vi.mocked(invoke).mockClear();
	await telemetryModule.telemetry.trackError('app.error', 'Failed', { operation: 'read' });
	await telemetryModule.telemetry.trackError('app.error', 'Failed', { operation: 'write' });
	await telemetryModule.telemetry.trackError('app.error', 'Failed', { operation: 'read' });
	window.dispatchEvent(new Event('pagehide'));
	await vi.advanceTimersByTimeAsync(0);
	expect(invoke).toHaveBeenCalledTimes(3);
	await vi.advanceTimersByTimeAsync(30_000);
	expect(invoke).toHaveBeenCalledTimes(3);
});

it('does not replay disabled errors or pending repeats after reenabling', async () => {
	await telemetryModule.telemetry.trackError('app.error', 'Failed');
	await telemetryModule.telemetry.trackError('app.error', 'Failed');
	await telemetryModule.telemetry.setPref('enabled', false);
	await telemetryModule.telemetry.trackError('app.error', 'Private disabled failure');
	await telemetryModule.telemetry.setPref('enabled', true);
	await vi.advanceTimersByTimeAsync(30_000);
	expect(
		vi.mocked(invoke).mock.calls.filter(([command]) => command === 'telemetry_track_error')
	).toHaveLength(1);
});

it('debounces continuous settings independently and keeps discrete events immediate', async () => {
	const first = telemetryModule.telemetry.trackEvent('reader.layout_changed', {
		setting: 'font_size_percent',
		value: 110,
	});
	await vi.advanceTimersByTimeAsync(300);
	const second = telemetryModule.telemetry.trackEvent('reader.layout_changed', {
		setting: 'font_size_percent',
		value: 120,
	});
	const colors = telemetryModule.telemetry.trackEvent('settings.changed', {
		setting: 'toneColors',
	});
	await telemetryModule.telemetry.trackEvent('bookmark.added');
	expect(invoke).toHaveBeenCalledTimes(1);
	await vi.advanceTimersByTimeAsync(500);
	await Promise.all([first, second, colors]);
	expect(invoke).toHaveBeenCalledTimes(3);
	expect(invoke).toHaveBeenCalledWith('telemetry_track_event', {
		name: 'reader.layout_changed',
		payload: { setting: 'font_size_percent', value: 120 },
	});
});
