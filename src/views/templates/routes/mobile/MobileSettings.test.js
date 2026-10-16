import { beforeEach, expect, vi } from 'vitest';
import { fireEvent, render, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import MobileSettings from '@/routes/mobile/MobileSettings.svelte';
import { settingsActiveTabStore } from '@/stores/settings.svelte.js';
import { appearanceStore } from '@/stores/appearance.svelte.js';
import { privacySettingsStore } from '@/stores/privacySettings.svelte.js';
import { telemetry } from '@/utils/telemetry.js';
import { setPreferenceManagerForTest } from '@/utils/appServices.js';
import { dictionaryDisplaySettingsStore } from '@/stores/dictionaryDisplaySettings.svelte.js';
import { databaseMigrationStore } from '@/stores/databaseMigration.svelte.js';
import { invoke } from '@tauri-apps/api/core';
import { bookmarkRecoveryStore } from '@/stores/bookmarkRecovery.svelte.js';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(() => Promise.resolve(false)) }));

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
	vi.mocked(invoke)
		.mockReset()
		.mockImplementation(async (command) =>
			command === 'read_bookmark_recovery_report' ? null : false
		);
	bookmarkRecoveryStore.resetForTest();
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
	await appearanceStore.loadSettings();
	await dictionaryDisplaySettingsStore.loadSettings();
	privacySettingsStore.setPrivacySettingsForTest({
		childPrivacyMode: false,
		completedOnboardingVersion: 1,
	});
	vi.mocked(telemetry.getPrefs).mockClear();
	vi.mocked(telemetry.getQueuedEvents).mockClear();
	vi.mocked(telemetry.setPref).mockClear();
	vi.mocked(telemetry.trackEvent).mockClear();
});

it('shows Increase Contrast in General only and keeps its state across mobile tabs', async () => {
	vi.mocked(invoke).mockImplementation(async (command) =>
		command === 'get_acknowledgements' ? [] : null
	);
	settingsActiveTabStore.set('acknowledgements');
	const user = userEvent.setup();
	const { getByRole, queryByRole } = render(MobileSettings);
	expect(queryByRole('checkbox', { name: 'Increase Contrast' })).toBeNull();
	await user.click(getByRole('tab', { name: 'General' }));
	const contrast = getByRole('checkbox', { name: 'Increase Contrast' });
	expect(contrast.closest('[role="tabpanel"]')).toBe(getByRole('tabpanel', { name: 'General' }));
	expect(getByRole('region', { name: 'Increase Contrast' }).contains(contrast)).toBe(true);
	expect(getByRole('region', { name: 'Increase Contrast' }).querySelector('p')).toBeNull();
	await user.click(contrast);
	expect(preferenceManager.set).toHaveBeenCalledWith('increaseContrast', true);
	expect(contrast.checked).toBe(true);
	await user.click(getByRole('tab', { name: 'Telemetry' }));
	expect(queryByRole('checkbox', { name: 'Increase Contrast' })).toBeNull();
	await user.click(getByRole('tab', { name: 'General' }));
	expect(getByRole('checkbox', { name: 'Increase Contrast' }).checked).toBe(true);
});

it('reopens saved recovery reports from phone settings', async () => {
	vi.mocked(invoke).mockImplementation(async (command) =>
		command === 'read_bookmark_recovery_report' ? 'Saved phone report' : false
	);
	const user = userEvent.setup();
	const { getByRole, queryByRole } = render(MobileSettings);
	expect(queryByRole('heading', { name: 'Bookmark Recovery' })).toBeNull();
	await waitFor(() => expect(getByRole('heading', { name: 'Bookmark Recovery' })).toBeTruthy());
	await user.click(getByRole('button', { name: 'View recovery reports' }));
	expect(bookmarkRecoveryStore.report).toBe('Saved phone report');
});

it.each([null, '', ' \n '])(
	'hides recovery settings when no saved report exists (%s)',
	async (report) => {
		vi.mocked(invoke).mockResolvedValue(report);
		const { queryByRole } = render(MobileSettings);

		await waitFor(() => expect(invoke).toHaveBeenCalledWith('read_bookmark_recovery_report'));
		expect(queryByRole('heading', { name: 'Bookmark Recovery' })).toBeNull();
		expect(queryByRole('button', { name: 'View recovery reports' })).toBeNull();
	}
);

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

it('restores the theme palette only after an explicit reset', async () => {
	const user = userEvent.setup();
	const { getByLabelText, getByRole } = render(MobileSettings);
	await fireEvent.change(getByLabelText('First Tone'), { target: { value: '#112233' } });
	await user.click(getByRole('button', { name: 'Reset to theme colors' }));
	expect(preferenceManager.set).toHaveBeenLastCalledWith('toneColors', {
		hasCustomColors: false,
		colors: [
			'--sy-tone-default--1',
			'--sy-tone-default--2',
			'--sy-tone-default--3',
			'--sy-tone-default--4',
			'--sy-tone-default--5',
		],
	});
});

it('shows every telemetry option on the telemetry tab', async () => {
	const user = userEvent.setup();
	const { getByText, getByRole } = render(MobileSettings);

	await user.click(getByText('Telemetry'));

	await waitFor(() => expect(getByRole('checkbox', { name: 'Enable Telemetry' })).toBeTruthy());
	expect(getByRole('checkbox', { name: 'Event Tracking' })).toBeTruthy();
	expect(getByRole('checkbox', { name: 'Screen Views' })).toBeTruthy();
	expect(getByRole('checkbox', { name: 'Error Reporting' })).toBeTruthy();
	expect(getByRole('checkbox', { name: 'Device Context' })).toBeTruthy();
	expect(getByText('Queued Telemetry Events')).toBeTruthy();
});

it('restores the last active settings tab', async () => {
	settingsActiveTabStore.set('telemetry');
	const { getByRole } = render(MobileSettings);

	await waitFor(() => expect(getByRole('checkbox', { name: 'Enable Telemetry' })).toBeTruthy());
});

it('shows age status on the telemetry tab while child privacy mode is on', async () => {
	privacySettingsStore.setPrivacySettingsForTest({
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
	const { getByText, queryByLabelText, queryByText } = render(MobileSettings);

	await user.click(getByText('Telemetry'));
	await waitFor(() => expect(getByText('Age Status')).toBeTruthy());
	expect(
		getByText(
			/additional restrictions apply based on the age information provided during setup/i
		)
	).toBeTruthy();
	expect(queryByLabelText('Enable Telemetry')).toBeNull();
	expect(queryByText('Recent Telemetry Events')).toBeNull();
});
