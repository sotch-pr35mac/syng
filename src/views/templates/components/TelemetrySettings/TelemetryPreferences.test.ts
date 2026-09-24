import { beforeEach, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import TelemetrySettings from '@/components/TelemetrySettings/TelemetrySettings.svelte';
import PrivacyStep from '@/components/Onboarding/PrivacyStep.svelte';
import { onboardingStore } from '@/stores/onboarding.svelte.js';
import { privacySettingsStore } from '@/stores/privacySettings.svelte.js';
import { setPreferenceManagerForTest } from '@/utils/appServices.js';
import { telemetry, type TelemetryPrefs } from '@/utils/telemetry.js';

vi.mock('@tauri-apps/api/core', () => ({
	invoke: vi.fn(() => Promise.resolve([{ code: 'CN', fallbackName: 'China' }])),
}));
vi.mock('@tauri-apps/plugin-opener', () => ({ openUrl: vi.fn() }));
vi.mock('@/utils/device.js', () => ({ isAndroid: () => false }));
vi.mock('@/utils/error.js', () => ({ handleError: vi.fn() }));
vi.mock('@/utils/telemetry.js', async (importOriginal) => ({
	...(await importOriginal<typeof import('@/utils/telemetry.js')>()),
	telemetry: {
		getPrefs: vi.fn(),
		setPref: vi.fn(),
		getQueuedEvents: vi.fn(() => Promise.resolve([])),
	},
}));

let confirmedPrefs: TelemetryPrefs;

beforeEach(async () => {
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
	setPreferenceManagerForTest({ set: vi.fn() } as never);
	privacySettingsStore.setPrivacySettingsForTest({ childPrivacyMode: false });
	onboardingStore.reset();
	await onboardingStore.selectRegion('CN');
	vi.mocked(telemetry.setPref).mockClear();
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
