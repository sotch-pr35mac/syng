import { beforeEach, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { openUrl } from '@tauri-apps/plugin-opener';
import AgeStatusSettings from '@/components/TelemetrySettings/AgeStatusSettings.svelte';
import TelemetrySettings from '@/components/TelemetrySettings/TelemetrySettings.svelte';
import { privacySettingsStore } from '@/stores/privacySettings.svelte.js';
import { setPreferenceManagerForTest } from '@/utils/appServices.js';
import { telemetry } from '@/utils/telemetry.js';

const telemetryState = vi.hoisted(() => ({
	enabled: false,
}));

const deviceState = vi.hoisted(() => ({
	isAndroid: false,
}));

vi.mock('@tauri-apps/plugin-opener', () => ({
	openUrl: vi.fn(() => Promise.resolve()),
}));

vi.mock('@/utils/device.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('@/utils/device.js')>();
	return {
		...actual,
		isAndroid: () => deviceState.isAndroid,
	};
});

vi.mock('@/utils/telemetry.js', () => ({
	telemetry: {
		trackEvent: vi.fn(() => Promise.resolve()),
		getPrefs: vi.fn(() =>
			Promise.resolve({
				enabled: telemetryState.enabled,
				track_events: true,
				track_screen_views: true,
				track_errors: true,
				include_device_context: true,
			})
		),
		getQueuedEvents: vi.fn(() => Promise.resolve([])),
		setPref: vi.fn((key: string, value: boolean) => {
			if (key === 'enabled') {
				telemetryState.enabled = value;
			}
			return Promise.resolve();
		}),
	},
}));

vi.mock('@/utils/error.js', () => ({
	handleError: vi.fn(),
}));

const preferences: Record<string, unknown> = {};

beforeEach(() => {
	telemetryState.enabled = false;
	deviceState.isAndroid = false;
	Object.assign(preferences, {
		childPrivacyMode: true,
		completedOnboardingVersion: 1,
	});
	setPreferenceManagerForTest({
		waitForInit: vi.fn(() => Promise.resolve()),
		get: vi.fn((name: string) => preferences[name]),
		set: vi.fn((name: string, value: unknown) => {
			preferences[name] = value;
		}),
	} as never);
	privacySettingsStore.setPrivacySettingsForTest({
		childPrivacyMode: true,
		completedOnboardingVersion: 1,
	});
	vi.mocked(telemetry.setPref).mockClear();
	vi.mocked(openUrl).mockClear();
});

it('shows the privacy notice and policy link on Android', () => {
	deviceState.isAndroid = true;
	const { getByRole, getByText } = render(TelemetrySettings);

	expect(getByText(/We respect your privacy\./)).not.toBeNull();
	const privacyLink = getByRole('link', {
		name: 'View our privacy policy to learn more.',
	}) as HTMLAnchorElement;
	expect(privacyLink.href).toBe('https://getsyng.com/privacy');
});

it('does not show the privacy policy link outside Android', () => {
	const { queryByRole } = render(TelemetrySettings);

	expect(queryByRole('link', { name: 'View our privacy policy to learn more.' })).toBeNull();
});

it('opens the Android privacy policy in the external browser', async () => {
	deviceState.isAndroid = true;
	const user = userEvent.setup();
	const { getByRole } = render(TelemetrySettings);

	await user.click(getByRole('link', { name: 'View our privacy policy to learn more.' }));

	expect(openUrl).toHaveBeenCalledOnce();
	expect(openUrl).toHaveBeenCalledWith('https://getsyng.com/privacy');
});

it('keeps child mode and telemetry off when age status stays below the threshold', async () => {
	const user = userEvent.setup();
	const { getByRole } = render(AgeStatusSettings);

	expect(
		Array.from(document.querySelectorAll('.age-status__actions button'), (button) =>
			button.textContent?.trim()
		)
	).toEqual(['No', 'Yes']);
	await user.click(getByRole('button', { name: 'No' }));

	expect(privacySettingsStore.childPrivacyMode).toBe(true);
	expect(telemetry.setPref).toHaveBeenCalledWith('enabled', false);
});

it('leaves child mode and restores telemetry when age status is no longer below the threshold', async () => {
	const user = userEvent.setup();
	const { getByRole } = render(AgeStatusSettings);

	await user.click(getByRole('button', { name: 'Yes' }));

	expect(privacySettingsStore.childPrivacyMode).toBe(false);
	expect(telemetry.setPref).toHaveBeenCalledWith('enabled', true);
});

it('locks the telemetry master toggle while child privacy mode is on', async () => {
	const { getByLabelText } = render(TelemetrySettings);

	await waitFor(() =>
		expect((getByLabelText('Enable Telemetry') as HTMLInputElement).disabled).toBe(true)
	);
	expect((getByLabelText('Enable Telemetry') as HTMLInputElement).checked).toBe(false);
});

it('unlocks the telemetry toggle after leaving child privacy mode', async () => {
	const user = userEvent.setup();
	privacySettingsStore.setPrivacySettingsForTest({
		childPrivacyMode: false,
		completedOnboardingVersion: 1,
	});
	telemetryState.enabled = true;
	const { getByLabelText } = render(TelemetrySettings);

	await waitFor(() =>
		expect((getByLabelText('Enable Telemetry') as HTMLInputElement).disabled).toBe(false)
	);
	expect((getByLabelText('Enable Telemetry') as HTMLInputElement).checked).toBe(true);

	await user.click(getByLabelText('Enable Telemetry'));
	expect(telemetry.setPref).toHaveBeenCalledWith('enabled', false);
});
