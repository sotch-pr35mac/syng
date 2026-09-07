import { beforeEach, expect, vi } from 'vitest';
import { render, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import Settings from '@/routes/Settings.svelte';
import { dictionaryDisplaySettingsStore } from '@/stores/dictionaryDisplaySettings.svelte.js';
import { privacySettingsStore } from '@/stores/privacySettings.svelte.js';
import { settingsActiveTabStore } from '@/stores/settings.svelte.js';
import { setPreferenceManagerForTest } from '@/utils/appServices.js';
import { telemetry } from '@/utils/telemetry.js';
import { databaseMigrationStore } from '@/stores/databaseMigration.svelte.js';

vi.mock('@/components/SettingsOption/UpdateChecker.svelte', async () => ({
	default: (await import('@/components/__mocks__/FeatherIcon.svelte')).default,
}));

vi.mock('@tauri-apps/plugin-os', () => ({
	platform: () => 'macos',
	version: () => Promise.resolve('15.0'),
}));

vi.mock('@tauri-apps/api/core', () => ({
	invoke: vi.fn(() => Promise.resolve(false)),
}));

vi.mock('@/utils/device.js', () => ({
	isMobile: () => false,
	isIPad: () => false,
	isIos: () => false,
	isAndroid: () => false,
	isMobileLayout: () => false,
}));

vi.mock('@/utils/telemetry.js', () => ({
	telemetry: {
		trackEvent: vi.fn(() => Promise.resolve()),
		getPrefs: vi.fn(() =>
			Promise.resolve({
				enabled: true,
				track_events: true,
				track_screen_views: true,
				track_errors: true,
				include_device_context: true,
			})
		),
		getQueuedEvents: vi.fn(() => Promise.resolve([])),
		setPref: vi.fn(() => Promise.resolve()),
	},
}));

const toneColors = {
	hasCustomColors: false,
	colors: ['#3366ff', '#ffcc00', '#ff3333', '#33aa66', '#777777'],
};

let preferenceManager;

beforeEach(async () => {
	settingsActiveTabStore.set('general');
	databaseMigrationStore.resetForTest();
	const preferences = {
		beta: false,
		characterSet: 'both',
		colorCharactersByTone: true,
		colorPinyinByTone: false,
		colorListsByTone: false,
		toneColors,
	};
	preferenceManager = {
		waitForInit: vi.fn(() => Promise.resolve()),
		get: vi.fn((name) => preferences[name]),
		set: vi.fn((name, value) => {
			preferences[name] = value;
		}),
	};
	setPreferenceManagerForTest(preferenceManager);
	await dictionaryDisplaySettingsStore.loadSettings();
	privacySettingsStore.setPrivacySettingsForTest({
		regionCode: null,
		childPrivacyMode: false,
		completedOnboardingVersion: 1,
	});
	vi.mocked(telemetry.trackEvent).mockClear();
});

it('starts a dismissible database migration preview from development settings', async () => {
	const user = userEvent.setup();
	const { getByRole, getByText } = render(Settings);

	expect(getByText('Database Migration')).toBeTruthy();
	await user.click(getByRole('button', { name: 'Preview migration screen' }));

	expect(databaseMigrationStore.status).toBe('running');
	expect(databaseMigrationStore.isPreview).toBe(true);
	expect(databaseMigrationStore.title).toBe('Updating your bookmarks…');
});

it('renders and updates desktop dictionary display settings', async () => {
	const user = userEvent.setup();
	const { getByRole, getByLabelText, getByText } = render(Settings);

	expect(getByText('Tone Coloring')).toBeTruthy();
	expect(getByText('Tone Colors')).toBeTruthy();
	expect(getByRole('radio', { name: 'Simplified + Traditional' }).checked).toBe(true);
	expect(getByLabelText('Color characters by tone').checked).toBe(true);
	expect(getByLabelText('Color pinyin by tone').checked).toBe(false);
	expect(getByLabelText('Apply tone coloring to lists').checked).toBe(false);

	await user.click(getByRole('radio', { name: 'Traditional' }));
	await user.click(getByLabelText('Color pinyin by tone'));
	await user.click(getByLabelText('Apply tone coloring to lists'));

	expect(preferenceManager.set).toHaveBeenCalledWith('characterSet', 'traditional');
	expect(preferenceManager.set).toHaveBeenCalledWith('colorPinyinByTone', true);
	expect(preferenceManager.set).toHaveBeenCalledWith('colorListsByTone', true);
	expect(telemetry.trackEvent).toHaveBeenCalledWith('settings.changed', {
		setting: 'characterSet',
	});
});

it('replays onboarding from the dev-only general setting', async () => {
	const user = userEvent.setup();
	const { getByRole, getByText } = render(Settings);

	expect(getByText('Replay onboarding')).toBeTruthy();
	await user.click(getByRole('button', { name: 'Show again' }));

	expect(preferenceManager.set).toHaveBeenCalledWith('forceOnboardingReplay', true);
	expect(privacySettingsStore.hasCompletedOnboarding).toBe(false);
});

it('shows age status on the telemetry tab and unlocks telemetry after leaving child mode', async () => {
	privacySettingsStore.setPrivacySettingsForTest({
		regionCode: 'US',
		childPrivacyMode: true,
		completedOnboardingVersion: 1,
	});
	vi.mocked(telemetry.getPrefs).mockResolvedValue({
		enabled: false,
		track_events: true,
		track_screen_views: true,
		track_errors: true,
		include_device_context: true,
	});
	const user = userEvent.setup();
	const { getByText, getByLabelText, queryByText } = render(Settings);

	await user.click(getByText('Telemetry'));
	await waitFor(() => expect(getByText(/additional privacy protections apply/i)).toBeTruthy());
	await waitFor(() => expect(getByLabelText('Enable Telemetry').disabled).toBe(true));

	await user.click(getByText('No'));

	expect(privacySettingsStore.childPrivacyMode).toBe(false);
	expect(telemetry.setPref).toHaveBeenCalledWith('enabled', true);
	vi.mocked(telemetry.getPrefs).mockResolvedValue({
		enabled: true,
		track_events: true,
		track_screen_views: true,
		track_errors: true,
		include_device_context: true,
	});
	await waitFor(() => {
		expect(queryByText(/additional privacy protections apply/i)).toBeNull();
		expect(getByLabelText('Enable Telemetry').disabled).toBe(false);
	});
});
