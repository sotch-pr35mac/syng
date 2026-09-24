import { invoke } from '@tauri-apps/api/core';
import { version } from '@tauri-apps/plugin-os';
import { NATIVE_COMMANDS } from '@/types/nativeCommands.js';
import type { TelemetryPayloads } from '@/types/telemetry.js';

let initialization: Promise<void> | undefined;
let masterEnabled = true;
let errorsEnabled = true;
let diagnosticsListenersInstalled = false;
const ERROR_WINDOW_MS = 30_000;
const MAX_ERROR_GROUPS = 100;
const MAX_DIAGNOSTIC_LENGTH = 8_000;
const MAX_DIAGNOSTIC_DEPTH = 8;
const SETTING_DEBOUNCE_MS = 500;
const diagnosticFields = new Set([
	'error_name',
	'error_message',
	'error_stack',
	'operation',
	'visibility_state',
	'ms_since_foreground',
	'code',
	'status',
	'stage',
]);
const privateFieldPattern =
	/(?:text|query|word|lexical|list|document|title|notes|password|token|secret|authorization|path|url|filename)/i;

/** Diagnostic prose is best-effort redacted; arbitrary object dumps never leave the app. */
export function redactDiagnosticText(text: string, privateValues: readonly string[] = []): string {
	let redacted = text;
	for (const value of [...privateValues]
		.filter(Boolean)
		.sort((left, right) => right.length - left.length)) {
		redacted = redacted.split(value).join('[redacted]');
	}
	return redacted
		.replace(/\b(?:Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi, '[redacted credential]')
		.replace(
			/\b(?:password|token|secret|api[_-]?key|authorization)\s*[:=]\s*["']?[^\s,"'}]+/gi,
			'[redacted credential]'
		)
		.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[redacted email]')
		.replace(/\b[a-z][a-z0-9+.-]*:\/\/[^\s)"']+/gi, '[redacted URL]')
		.replace(
			/(?:[A-Za-z]:\\|\\\\|\/(?:Users|home|private|tmp|var|Volumes)\/)[^\n)"']+/g,
			'[redacted path]'
		)
		.replace(/\/(?:[A-Za-z0-9_.~-]+\/)+[^\s)"']*/g, '[redacted path]')
		.replace(/\b\d+:(?:[0-9a-f]{64}|[a-z][a-z0-9_-]+)\b/gi, '[redacted lexical ID]')
		.slice(0, MAX_DIAGNOSTIC_LENGTH);
}

export function sanitizeDiagnostics(message: string, payload: Record<string, unknown>) {
	const privateValues: string[] = [];
	const visited = new WeakSet<object>();
	const collect = (value: unknown, privateField = false, depth = 0): void => {
		if (depth > MAX_DIAGNOSTIC_DEPTH) {
			return;
		}
		if (typeof value === 'string' && privateField) {
			privateValues.push(value);
		}
		if (!value || typeof value !== 'object' || visited.has(value)) {
			return;
		}
		visited.add(value);
		for (const [key, child] of Object.entries(value)) {
			collect(child, privateField || privateFieldPattern.test(key), depth + 1);
		}
	};
	collect(payload);
	// Older callers serialize objects. Read only to discover content to redact, never send them.
	if (typeof payload.error_payload === 'string') {
		try {
			collect(JSON.parse(payload.error_payload));
		} catch {
			/* Not structured diagnostics. */
		}
	}
	const safePayload: Record<string, string | number | boolean> = {};
	for (const [key, value] of Object.entries(payload)) {
		if (!diagnosticFields.has(key)) {
			continue;
		}
		if (typeof value === 'string') {
			safePayload[key] = redactDiagnosticText(value, privateValues);
		} else if (
			typeof value === 'boolean' ||
			(typeof value === 'number' && Number.isFinite(value))
		) {
			safePayload[key] = value;
		}
	}
	return { message: redactDiagnosticText(message, privateValues), payload: safePayload };
}

async function invokeTelemetry<Result>(
	command: string,
	args?: Record<string, unknown>
): Promise<Result> {
	if (initialization) {
		await initialization;
	}
	return invoke<Result>(command, args);
}

interface ErrorGroup {
	name: string;
	message: string;
	payload: Record<string, unknown>;
	repeats: number;
	timer: ReturnType<typeof setTimeout>;
}
const errorGroups = new Map<string, ErrorGroup>();
interface PendingSetting {
	timer: ReturnType<typeof setTimeout>;
	send: () => void;
	cancel: () => void;
}
const pendingSettings = new Map<string, PendingSetting>();

function flushErrorGroup(key: string): void {
	const group = errorGroups.get(key);
	if (!group) {
		return;
	}
	clearTimeout(group.timer);
	errorGroups.delete(key);
	if (group.repeats) {
		void invokeTelemetry(NATIVE_COMMANDS.TELEMETRY.TRACK_ERROR, {
			name: group.name,
			message: group.message,
			payload: { ...group.payload, occurrence_count: group.repeats, summary: true },
		}).catch(() => {});
	}
}

export function flushTelemetrySummaries(): void {
	for (const key of errorGroups.keys()) {
		flushErrorGroup(key);
	}
	for (const pending of pendingSettings.values()) {
		pending.send();
	}
}

function discardErrorSummaries(): void {
	for (const group of errorGroups.values()) {
		clearTimeout(group.timer);
	}
	errorGroups.clear();
}

function trackEvent<Name extends string>(
	name: Name,
	...args: Name extends keyof TelemetryPayloads
		? [payload: TelemetryPayloads[Name]]
		: [payload?: Record<string, unknown>]
): Promise<void> {
	const payload = args[0] ?? {};
	const setting = 'setting' in payload ? String(payload.setting) : '';
	if (
		name === 'reader.layout_changed' ||
		(name === 'settings.changed' && setting === 'toneColors')
	) {
		const key = `${name}:${setting}`;
		pendingSettings.get(key)?.cancel();
		return new Promise<void>((resolve, reject) => {
			const send = () => {
				const pending = pendingSettings.get(key);
				if (!pending) {
					return;
				}
				clearTimeout(pending.timer);
				pendingSettings.delete(key);
				void invokeTelemetry<void>(NATIVE_COMMANDS.TELEMETRY.TRACK_EVENT, {
					name,
					payload,
				}).then(resolve, reject);
			};
			const cancel = () => {
				clearTimeout(pendingSettings.get(key)?.timer);
				pendingSettings.delete(key);
				resolve();
			};
			pendingSettings.set(key, {
				send,
				cancel,
				timer: setTimeout(send, SETTING_DEBOUNCE_MS),
			});
		});
	}
	return invokeTelemetry(NATIVE_COMMANDS.TELEMETRY.TRACK_EVENT, { name, payload });
}

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

const READER_DOCUMENT_ROUTE_PATTERN = /^\/read\/document\/.+/;

/**
 * Maps a hash-router location to a telemetry screen name. Document IDs
 * are stripped from dynamic routes so telemetry does not record which
 * specific document the user is viewing.
 */
export function getRouteScreenName(
	location: string,
	screenNames: Record<string, string>
): string | undefined {
	if (READER_DOCUMENT_ROUTE_PATTERN.test(location)) {
		return 'reader';
	}
	return screenNames[location];
}

export const telemetry = {
	init: (): Promise<void> => {
		if (initialization) {
			return initialization;
		}
		if (!diagnosticsListenersInstalled && typeof document !== 'undefined') {
			diagnosticsListenersInstalled = true;
			document.addEventListener('visibilitychange', () => {
				if (document.visibilityState === 'hidden') {
					flushTelemetrySummaries();
				}
			});
			window.addEventListener('pagehide', flushTelemetrySummaries);
		}
		let osVersion = '';
		try {
			osVersion = version();
		} catch {
			// noop
		}
		let timezone = '';
		try {
			timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
		} catch {
			// noop
		}
		initialization = invoke<void>(NATIVE_COMMANDS.TELEMETRY.INIT, { osVersion, timezone })
			.then(() => invoke<TelemetryPrefs>(NATIVE_COMMANDS.TELEMETRY.GET_PREFS))
			.then((prefs) => {
				masterEnabled = prefs.enabled;
				errorsEnabled = prefs.track_errors;
				return undefined;
			});
		return initialization;
	},
	trackEvent,
	trackScreen: (name: string, payload: Record<string, unknown> = {}): Promise<void> =>
		invokeTelemetry(NATIVE_COMMANDS.TELEMETRY.TRACK_SCREEN, { name, payload }),
	trackError: async (
		name: string,
		message: string,
		payload: Record<string, unknown> = {}
	): Promise<void> => {
		if (initialization) {
			await initialization;
		}
		if (!masterEnabled || !errorsEnabled) {
			return;
		}
		const safe = sanitizeDiagnostics(message, payload);
		const key = JSON.stringify([
			name,
			safe.payload.operation,
			safe.message,
			safe.payload.error_message,
		]);
		const existing = errorGroups.get(key);
		if (existing) {
			existing.repeats += 1;
			return;
		}
		if (errorGroups.size >= MAX_ERROR_GROUPS) {
			flushErrorGroup(errorGroups.keys().next().value!);
		}
		errorGroups.set(key, {
			name,
			...safe,
			repeats: 0,
			timer: setTimeout(() => flushErrorGroup(key), ERROR_WINDOW_MS),
		});
		await invokeTelemetry(NATIVE_COMMANDS.TELEMETRY.TRACK_ERROR, {
			name,
			...safe,
			payload: { ...safe.payload, occurrence_count: 1 },
		});
	},
	getQueuedEvents: (limit = 50): Promise<TelemetryEvent[]> =>
		invokeTelemetry(NATIVE_COMMANDS.TELEMETRY.GET_QUEUED_EVENTS, { limit }),
	getPrefs: (): Promise<TelemetryPrefs> => invokeTelemetry(NATIVE_COMMANDS.TELEMETRY.GET_PREFS),
	setPref: async (key: string, value: boolean): Promise<void> => {
		await invokeTelemetry(NATIVE_COMMANDS.TELEMETRY.SET_PREF, { key, value });
		if (key === 'enabled') {
			masterEnabled = value;
		}
		if (key === 'track_errors') {
			errorsEnabled = value;
		}
		if ((key === 'enabled' || key === 'track_errors') && !value) {
			discardErrorSummaries();
		}
		if ((key === 'enabled' || key === 'track_events') && !value) {
			for (const pending of pendingSettings.values()) {
				pending.cancel();
			}
		}
	},
};

const EXAMPLE_DEVICE_CONTEXT = {
	arch: 'aarch64',
	os_version: '15.0',
	timezone: 'Etc/UTC',
};

const EXAMPLE_ENVELOPE_BASE = {
	device_id: 'example-device',
	app_version: '2.4.0',
	platform: 'macos',
	timestamp_ms: 0,
};

/**
 * Placeholder telemetry envelopes for onboarding. Categories appear only when
 * enabled; device context is included only when that preference is on.
 */
export function exampleTelemetryEnvelopes(prefs: TelemetryPrefs): Record<string, unknown>[] {
	if (!prefs.enabled) {
		return [];
	}

	const withContext = (envelope: Record<string, unknown>): Record<string, unknown> =>
		prefs.include_device_context
			? { ...envelope, device_context: EXAMPLE_DEVICE_CONTEXT }
			: envelope;

	const envelopes: Record<string, unknown>[] = [];
	if (prefs.track_events) {
		envelopes.push(
			withContext({
				...EXAMPLE_ENVELOPE_BASE,
				id: 'example-event',
				family: 'event',
				name: 'onboarding.step_viewed',
				payload: { step: 'welcome' },
			})
		);
	}
	if (prefs.track_screen_views) {
		envelopes.push(
			withContext({
				...EXAMPLE_ENVELOPE_BASE,
				id: 'example-screen',
				family: 'screen_view',
				name: 'search',
				payload: {},
			})
		);
	}
	if (prefs.track_errors) {
		envelopes.push(
			withContext({
				...EXAMPLE_ENVELOPE_BASE,
				id: 'example-error',
				family: 'error',
				name: 'app.error',
				payload: { message: 'Example error' },
			})
		);
	}
	return envelopes;
}
