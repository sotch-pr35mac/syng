import { beforeEach, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import userEvent from '@testing-library/user-event';
import TelemetrySettings from '@/components/TelemetrySettings/TelemetrySettings.svelte';
import PrivacyStep from '@/components/Onboarding/PrivacyStep.svelte';
import { onboardingStore } from '@/stores/onboarding.svelte.js';
import { privacySettingsStore } from '@/stores/privacySettings.svelte.js';
import { setPreferenceManagerForTest } from '@/utils/appServices.js';
import { telemetry, type TelemetryEvent, type TelemetryPrefs } from '@/utils/telemetry.js';

vi.mock('@tauri-apps/api/core', () => ({
	invoke: vi.fn(() => Promise.resolve([{ code: 'CN', fallbackName: 'China' }])),
}));
vi.mock('@tauri-apps/plugin-opener', () => ({ openUrl: vi.fn() }));
const deviceState = vi.hoisted(() => ({ android: false }));
vi.mock('@/utils/device.js', () => ({
	isAndroid: () => deviceState.android,
	isMobile: () => false,
}));
vi.mock('@/utils/error.js', () => ({ handleError: vi.fn() }));
vi.mock('@/utils/telemetry.js', async (importOriginal) => ({
	...(await importOriginal<typeof import('@/utils/telemetry.js')>()),
	telemetry: {
		trackScreen: vi.fn(() => Promise.resolve()),
		getPrefs: vi.fn(),
		setPref: vi.fn(),
		getQueuedEvents: vi.fn(() => Promise.resolve([])),
	},
}));

let confirmedPrefs: TelemetryPrefs;

beforeEach(async () => {
	deviceState.android = false;
	confirmedPrefs = {
		enabled: true,
		track_events: true,
		track_screen_views: true,
		track_errors: true,
		include_device_context: true,
	};
	vi.mocked(telemetry.getPrefs)
		.mockReset()
		.mockImplementation(async () => ({ ...confirmedPrefs }));
	vi.mocked(telemetry.setPref)
		.mockReset()
		.mockImplementation(async (key, value) => {
			confirmedPrefs[key as keyof TelemetryPrefs] = value;
		});
	vi.mocked(telemetry.getQueuedEvents).mockReset().mockResolvedValue([]);
	vi.mocked(telemetry.trackScreen).mockClear();
	setPreferenceManagerForTest({ set: vi.fn(), get: vi.fn() } as never);
	privacySettingsStore.setPrivacySettingsForTest({ childPrivacyMode: false });
	onboardingStore.reset();
	await onboardingStore.selectRegion('CN');
	vi.mocked(telemetry.setPref).mockClear();
});

it.each([false, true])('shows one footer privacy policy link when Android is %s', (android) => {
	deviceState.android = android;
	const view = render(TelemetrySettings);
	const policyLinks = view.getAllByRole('link', { name: 'Privacy policy' });
	expect(policyLinks).toHaveLength(1);
	expect(policyLinks[0].getAttribute('href')).toBe('https://getsyng.com/privacy');
	expect(view.queryByText('We respect your privacy.')).toBeNull();
});

const screens = [
	{ name: 'settings desktop', component: TelemetrySettings, variant: 'desktop' },
	{ name: 'settings mobile', component: TelemetrySettings, variant: 'mobile' },
	{ name: 'onboarding desktop', component: PrivacyStep, variant: 'desktop' },
	{ name: 'onboarding mobile', component: PrivacyStep, variant: 'mobile' },
] as const;
const preferenceKeys: (keyof TelemetryPrefs)[] = [
	'enabled',
	'track_events',
	'track_screen_views',
	'track_errors',
	'include_device_context',
];

for (const screen of screens) {
	it.each(preferenceKeys)(
		`${screen.name}: restores %s and displays a save failure`,
		async (key) => {
			const user = userEvent.setup();
			const view = render(screen.component, { variant: screen.variant });
			const toggle = view.container.querySelector<HTMLInputElement>(`input[value="${key}"]`)!;
			await waitFor(() => expect(toggle.checked).toBe(true));
			vi.mocked(telemetry.setPref).mockRejectedValueOnce(new Error('disk full'));

			await user.click(toggle);

			expect(telemetry.setPref).toHaveBeenCalledWith(key, false);
			expect(confirmedPrefs[key]).toBe(true);
			expect(await view.findByRole('alert')).toHaveProperty(
				'textContent',
				expect.stringContaining('previous setting')
			);
			await waitFor(() => expect(toggle.checked).toBe(true));
			expect(toggle.disabled).toBe(false);
			if (screen.component === PrivacyStep && key === 'enabled') {
				expect(view.queryByText('No telemetry is sent with these settings.')).toBeNull();
			}

			await user.click(toggle);
			await waitFor(() => expect(toggle.checked).toBe(false));
			expect(confirmedPrefs[key]).toBe(false);
			expect(view.queryByRole('alert')).toBeNull();
		}
	);

	it(`${screen.name}: prevents overlapping writes while saving`, async () => {
		const user = userEvent.setup();
		const view = render(screen.component, { variant: screen.variant });
		const toggle = view.container.querySelector<HTMLInputElement>(
			'input[value="track_events"]'
		)!;
		await waitFor(() => expect(toggle.checked).toBe(true));
		let rejectSave!: (error: Error) => void;
		vi.mocked(telemetry.setPref).mockImplementationOnce(
			() =>
				new Promise<void>((_resolve, reject) => {
					rejectSave = reject;
				})
		);
		await user.click(toggle);
		const toggles = view.container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
		for (const pendingToggle of toggles) {
			expect(pendingToggle.disabled).toBe(true);
		}
		await user.click(toggle);
		expect(telemetry.setPref).toHaveBeenCalledTimes(1);
		rejectSave(new Error('disk full'));
		await view.findByRole('alert');
		expect(toggle.checked).toBe(true);
		expect(toggle.disabled).toBe(false);
	});
}

it('inspects recent queued payloads in batches and filters the full fetched set', async () => {
	const pendingEvents: TelemetryEvent[] = Array.from({ length: 50 }, (_unusedValue, index) => ({
		id: String(index),
		family: index % 4 === 0 ? 'error' : index % 4 === 1 ? 'screen_view' : 'event',
		name: index === 49 ? 'unique.event' : `sample.${index}`,
		timestamp_ms: 1_700_000_000_000 - index * 60_000,
		payload: { sample: index },
	}));
	vi.mocked(telemetry.getQueuedEvents).mockResolvedValue(pendingEvents);
	const user = userEvent.setup();
	const view = render(TelemetrySettings);

	await waitFor(() => expect(telemetry.getQueuedEvents).toHaveBeenCalledWith(50));
	expect(view.container.querySelectorAll('.sy-collapsible-list--header')).toHaveLength(0);
	await user.click(view.getByRole('button', { name: 'Inspect queue →' }));
	expect(telemetry.trackScreen).toHaveBeenCalledWith('settings_telemetry_queue');
	expect(document.activeElement).toBe(view.getByRole('heading', { name: 'Pending payloads' }));
	expect(view.container.querySelectorAll('.sy-collapsible-list--header')).toHaveLength(10);
	expect(view.getByRole('radio', { name: 'All' })).toHaveProperty('checked', true);
	await user.click(view.getByRole('button', { name: 'Show 10 more' }));
	expect(view.container.querySelectorAll('.sy-collapsible-list--header')).toHaveLength(20);

	const search = view.getByRole('searchbox', { name: 'Find a queued event' });
	await user.type(search, 'unique.event');
	expect(view.container.querySelectorAll('.sy-collapsible-list--header')).toHaveLength(1);
	expect(view.getByText('unique.event')).toBeTruthy();
	await user.clear(search);
	await user.click(view.getByRole('radio', { name: 'Errors' }));
	expect(view.getByRole('radio', { name: 'Errors' })).toHaveProperty('checked', true);
	expect(view.container.querySelectorAll('.sy-collapsible-list--header')).toHaveLength(10);
	await user.click(view.getByRole('button', { name: 'Show 3 more' }));
	expect(view.container.querySelectorAll('.sy-collapsible-list--header')).toHaveLength(13);

	await user.click(view.getByRole('button', { name: 'Telemetry Settings' }));
	expect(view.getByRole('checkbox', { name: 'Enable Telemetry' })).toBeTruthy();
	expect(document.activeElement).toBe(view.getByRole('button', { name: 'Inspect queue →' }));
	expect(view.container.querySelectorAll('.sy-collapsible-list--header')).toHaveLength(0);
});

it('keeps the inspected queue fixed through refreshes and samples again on reentry', async () => {
	const initialEvent: TelemetryEvent = {
		id: 'pending-1',
		family: 'event',
		name: 'queued.before.open',
		timestamp_ms: 1_700_000_000_000,
	};
	vi.mocked(telemetry.getQueuedEvents).mockResolvedValue([initialEvent]);
	let refreshQueue: (() => Promise<void>) | undefined;
	const intervalSpy = vi
		.spyOn(globalThis, 'setInterval')
		.mockImplementation((handler, timeout) => {
			if (timeout === 5000) {
				refreshQueue = handler as () => Promise<void>;
			}
			return 0 as unknown as ReturnType<typeof setInterval>;
		});
	try {
		const user = userEvent.setup();
		const view = render(TelemetrySettings);
		await user.click(view.getByRole('button', { name: 'Inspect queue →' }));
		expect(view.getByText('queued.before.open')).toBeTruthy();
		expect(refreshQueue).toBeDefined();

		vi.mocked(telemetry.getQueuedEvents).mockResolvedValue([]);
		await refreshQueue?.();
		await tick();
		expect(view.getByText('queued.before.open')).toBeTruthy();

		await user.click(view.getByRole('button', { name: 'Telemetry Settings' }));
		await user.click(view.getByRole('button', { name: 'Inspect queue →' }));
		expect(view.queryByText('queued.before.open')).toBeNull();
		expect(view.getByText('No pending payloads right now.')).toBeTruthy();
		expect(
			vi
				.mocked(telemetry.trackScreen)
				.mock.calls.filter(([name]) => name === 'settings_telemetry_queue')
		).toHaveLength(2);
	} finally {
		intervalSpy.mockRestore();
	}
});
