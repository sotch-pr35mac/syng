import { beforeEach, expect, vi } from 'vitest';
import { fireEvent, render, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import MobileSettings from '@/routes/mobile/MobileSettings.svelte';
import { settingsActiveTabStore } from '@/stores/settings.svelte.js';
import { privacySettingsStore } from '@/stores/privacySettings.svelte.js';
import { telemetry } from '@/utils/telemetry.js';
import { setPreferenceManagerForTest } from '@/utils/appServices.js';
import { dictionaryDisplaySettingsStore } from '@/stores/dictionaryDisplaySettings.svelte.js';
import { databaseMigrationStore } from '@/stores/databaseMigration.svelte.js';

vi.mock('@/utils/telemetry.js', () => ({
	telemetry: {
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
		trackEvent: vi.fn(() => Promise.resolve()),
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
	preferenceManager = {
		waitForInit: vi.fn(() => Promise.resolve()),
		get: vi.fn((name) => {
			if (name === 'toneColors') {
				return toneColors;
			}
			return {
				characterSet: 'both',
				colorCharactersByTone: true,
				colorPinyinByTone: false,
				colorListsByTone: false,
			}[name];
		}),
		set: vi.fn(),
	};
	setPreferenceManagerForTest(preferenceManager);
	await dictionaryDisplaySettingsStore.loadSettings();
	privacySettingsStore.setPrivacySettingsForTest({
		regionCode: null,
		childPrivacyMode: false,
		completedOnboardingVersion: 1,
	});
	vi.mocked(telemetry.getPrefs).mockClear();
	vi.mocked(telemetry.getQueuedEvents).mockClear();
	vi.mocked(telemetry.setPref).mockClear();
	vi.mocked(telemetry.trackEvent).mockClear();
});

it('starts a dismissible database migration preview from development settings', async () => {
	const user = userEvent.setup();
	const { getByRole, getByText } = render(MobileSettings);

	expect(getByText('Database Migration')).toBeTruthy();
	await user.click(getByRole('button', { name: 'Preview migration screen' }));

	expect(databaseMigrationStore.status).toBe('running');
	expect(databaseMigrationStore.isPreview).toBe(true);
});

it('renders the mobile general settings without desktop-only options', () => {
	const { getByRole, queryByRole, queryByText } = render(MobileSettings);

	expect(queryByRole('heading', { name: 'Settings' })).toBeNull();
	expect(getByRole('heading', { name: 'Characters' })).toBeTruthy();
	expect(getByRole('heading', { name: 'Tone Coloring' })).toBeTruthy();
	expect(getByRole('heading', { name: 'Tone Colors' })).toBeTruthy();
	expect(queryByText('Updates')).toBeNull();
	expect(queryByText('Under Construction Features')).toBeNull();
});

it('replays onboarding from the dev-only general setting', async () => {
	const user = userEvent.setup();
	const { getByRole, getByText } = render(MobileSettings);

	expect(getByText('Replay onboarding')).toBeTruthy();
	await user.click(getByRole('button', { name: 'Show again' }));

	expect(preferenceManager.set).toHaveBeenCalledWith('forceOnboardingReplay', true);
	expect(privacySettingsStore.hasCompletedOnboarding).toBe(false);
});

it('updates the character-set radio preference', async () => {
	const user = userEvent.setup();
	const { getByRole } = render(MobileSettings);

	await user.click(getByRole('radio', { name: 'Traditional' }));

	expect(preferenceManager.set).toHaveBeenCalledWith('characterSet', 'traditional');
	expect(telemetry.trackEvent).toHaveBeenCalledWith('settings.changed', {
		setting: 'characterSet',
	});
});

it('updates the independent tone-coloring toggles', async () => {
	const user = userEvent.setup();
	const { getByLabelText } = render(MobileSettings);

	await user.click(getByLabelText('Color characters by tone'));
	await user.click(getByLabelText('Color pinyin by tone'));
	await user.click(getByLabelText('Apply tone coloring to lists'));

	expect(preferenceManager.set).toHaveBeenCalledWith('colorCharactersByTone', false);
	expect(preferenceManager.set).toHaveBeenCalledWith('colorPinyinByTone', true);
	expect(preferenceManager.set).toHaveBeenCalledWith('colorListsByTone', true);
	expect(preferenceManager.set).not.toHaveBeenCalledWith('toneColors', expect.anything());
});

it('updates tone colors through the shared settings handler', async () => {
	const { getByLabelText } = render(MobileSettings);
	const firstTone = getByLabelText('First Tone');

	await fireEvent.change(firstTone, { target: { value: '#111111' } });

	expect(preferenceManager.set).toHaveBeenCalledWith('toneColors', {
		hasCustomColors: true,
		colors: ['#111111', '#ffcc00', '#ff3333', '#33aa66', '#777777'],
	});
	expect(telemetry.trackEvent).toHaveBeenCalledWith('settings.changed', {
		setting: 'toneColors',
	});
});

it('shows every telemetry option on the telemetry tab', async () => {
	const user = userEvent.setup();
	const { getByText } = render(MobileSettings);

	await user.click(getByText('Telemetry'));

	await waitFor(() => expect(getByText('Enable Telemetry')).toBeTruthy());
	expect(getByText('Event Tracking')).toBeTruthy();
	expect(getByText('Screen Views')).toBeTruthy();
	expect(getByText('Error Reporting')).toBeTruthy();
	expect(getByText('Device Context')).toBeTruthy();
	expect(getByText('Recent Telemetry Events')).toBeTruthy();
});

it('restores the last active settings tab', async () => {
	settingsActiveTabStore.set('telemetry');
	const { getByText } = render(MobileSettings);

	await waitFor(() => expect(getByText('Enable Telemetry')).toBeTruthy());
});

it('shows age status on the telemetry tab while child privacy mode is on', async () => {
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
	const { getByText, getByLabelText } = render(MobileSettings);

	await user.click(getByText('Telemetry'));
	await waitFor(() => expect(getByText(/additional privacy protections apply/i)).toBeTruthy());
	await waitFor(() => expect(getByLabelText('Enable Telemetry').disabled).toBe(true));
});
