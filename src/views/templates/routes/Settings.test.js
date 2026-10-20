import { afterEach, beforeEach, expect, vi } from 'vitest';
import { render, waitFor, within, fireEvent } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import Settings from '@/routes/Settings.svelte';
import { dictionaryDisplaySettingsStore } from '@/stores/dictionaryDisplaySettings.svelte.js';
import { privacySettingsStore } from '@/stores/privacySettings.svelte.js';
import { settingsActiveTabStore, settingsScrollStore } from '@/stores/settings.svelte.js';
import { contrastStore } from '@/stores/contrast.svelte.js';
import { walkthroughStore } from '@/stores/walkthrough.svelte.js';
import * as settings from '@/composables/settings.js';
import { setPreferenceManagerForTest } from '@/utils/appServices.js';
import { telemetry } from '@/utils/telemetry.js';
import { databaseMigrationStore } from '@/stores/databaseMigration.svelte.js';
import { isIPad, isMobile } from '@/utils/device.js';
import { invoke } from '@tauri-apps/api/core';
import { bookmarkRecoveryStore } from '@/stores/bookmarkRecovery.svelte.js';

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
	isMobile: vi.fn(() => false),
	isIPad: vi.fn(() => false),
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
	vi.mocked(invoke)
		.mockReset()
		.mockImplementation(async (command) =>
			command === 'read_bookmark_recovery_report' ? null : false
		);
	vi.mocked(isMobile).mockReturnValue(false);
	vi.mocked(isIPad).mockReturnValue(false);
	bookmarkRecoveryStore.resetForTest();
	settingsActiveTabStore.set('general');
	settingsScrollStore.resetForTest();
	databaseMigrationStore.resetForTest();
	const preferences = {
		beta: false,
		characterSet: 'both',
		colorCharactersByTone: true,
		colorPinyinByTone: false,
		colorListsByTone: false,
		showQualifiers: true,
		showPartsOfSpeech: true,
		showAlternativePronunciations: false,
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
	await contrastStore.loadSettings();
	await dictionaryDisplaySettingsStore.loadSettings();
	privacySettingsStore.setPrivacySettingsForTest({
		childPrivacyMode: false,
		completedOnboardingVersion: 1,
	});
	vi.mocked(telemetry.trackEvent).mockClear();
});

it('shows Increase Contrast with General options only and keeps its state across tabs', async () => {
	vi.mocked(invoke).mockImplementation(async (command) =>
		command === 'get_acknowledgements'
			? []
			: command === 'read_bookmark_recovery_report'
				? null
				: false
	);
	settingsActiveTabStore.set('acknowledgements');
	const user = userEvent.setup();
	const { getByRole, queryByRole } = render(Settings);
	expect(queryByRole('checkbox', { name: 'Increase Contrast' })).toBeNull();
	await user.click(getByRole('tab', { name: 'General' }));
	const contrast = getByRole('checkbox', { name: 'Increase Contrast' });
	expect(contrast.closest('[role="tabpanel"]')).toBe(getByRole('tabpanel', { name: 'General' }));
	expect(contrast.closest('.settings--setting')?.querySelector('h3')?.textContent).toBe(
		'Increase Contrast'
	);
	expect(
		contrast.closest('.settings--setting')?.querySelector('.increase-contrast-settings > label')
	).toBeNull();
	await user.click(contrast);
	expect(preferenceManager.set).toHaveBeenCalledWith('increaseContrast', true);
	expect(contrast.checked).toBe(true);
	await user.click(getByRole('tab', { name: 'Telemetry' }));
	expect(queryByRole('checkbox', { name: 'Increase Contrast' })).toBeNull();
	await user.click(getByRole('tab', { name: 'General' }));
	expect(getByRole('checkbox', { name: 'Increase Contrast' }).checked).toBe(true);
});

it('reopens saved recovery reports from iPad settings', async () => {
	vi.mocked(isMobile).mockReturnValue(true);
	vi.mocked(isIPad).mockReturnValue(true);
	vi.mocked(invoke).mockImplementation(async (command) =>
		command === 'read_bookmark_recovery_report' ? 'Saved iPad report' : false
	);
	const user = userEvent.setup();
	const { getByRole, queryByText } = render(Settings);
	expect(queryByText('Bookmark Recovery')).toBeNull();
	await waitFor(() => expect(queryByText('Bookmark Recovery')).toBeTruthy());
	await user.click(getByRole('button', { name: 'View recovery reports' }));
	expect(bookmarkRecoveryStore.report).toBe('Saved iPad report');
});

it('hides recovery settings on iPad when no saved report exists', async () => {
	vi.mocked(isMobile).mockReturnValue(true);
	vi.mocked(isIPad).mockReturnValue(true);
	vi.mocked(invoke).mockResolvedValue(null);
	const { queryByText, queryByRole } = render(Settings);

	await waitFor(() => expect(invoke).toHaveBeenCalledWith('read_bookmark_recovery_report'));
	expect(queryByText('Bookmark Recovery')).toBeNull();
	expect(queryByRole('button', { name: 'View recovery reports' })).toBeNull();
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
	expect(getByRole('heading', { name: 'Dictionary details' })).toBeTruthy();
	expect(getByRole('radio', { name: 'Simplified + Traditional' }).checked).toBe(true);
	expect(getByLabelText('Color characters by tone').checked).toBe(true);
	expect(getByLabelText('Color pinyin by tone').checked).toBe(false);
	expect(getByLabelText('Apply tone coloring to lists').checked).toBe(false);
	expect(getByLabelText('Show qualifiers').checked).toBe(true);
	expect(getByLabelText('Show parts of speech').checked).toBe(true);
	expect(getByLabelText('Show alternative pronunciations').checked).toBe(false);

	await user.click(getByRole('radio', { name: 'Traditional' }));
	await user.click(getByLabelText('Color pinyin by tone'));
	await user.click(getByLabelText('Apply tone coloring to lists'));
	await user.click(getByLabelText('Show qualifiers'));
	await user.click(getByLabelText('Show parts of speech'));
	await user.click(getByLabelText('Show alternative pronunciations'));

	expect(preferenceManager.set).toHaveBeenCalledWith('characterSet', 'traditional');
	expect(preferenceManager.set).toHaveBeenCalledWith('colorPinyinByTone', true);
	expect(preferenceManager.set).toHaveBeenCalledWith('colorListsByTone', true);
	expect(preferenceManager.set).toHaveBeenCalledWith('showQualifiers', false);
	expect(preferenceManager.set).toHaveBeenCalledWith('showPartsOfSpeech', false);
	expect(preferenceManager.set).toHaveBeenCalledWith('showAlternativePronunciations', true);
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
	const { getByText, getByLabelText, queryByText, queryByLabelText } = render(Settings);

	await user.click(getByText('Telemetry'));
	await waitFor(() => expect(getByText('Age Status')).toBeTruthy());
	expect(
		getByText(
			/additional restrictions apply based on the age information provided during setup/i
		)
	).toBeTruthy();
	expect(
		getByText(/are you now at least the minimum digital consent age in your country or region/i)
	).toBeTruthy();
	expect(queryByLabelText('Enable Telemetry')).toBeNull();
	expect(queryByText('Recent Telemetry Events')).toBeNull();

	await user.click(getByText('Yes'));

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
		expect(queryByText('Age Status')).toBeNull();
		expect(getByLabelText('Enable Telemetry').disabled).toBe(false);
	});
});

afterEach(() => {
	vi.restoreAllMocks();
});

it('resets feature tours and invitations from developer settings', async () => {
	for (const identifier of ['dictionary', 'reader-library', 'reader-document', 'flashcards']) {
		walkthroughStore.preferences.guides[identifier] = {
			status: 'completed',
			completed: true,
			context: {},
		};
	}
	walkthroughStore.preferences.guides.quiz = { status: 'skipped', context: {} };
	walkthroughStore.preferences.featureInvitations = { flashcards: true, quiz: true };
	const user = userEvent.setup();
	const view = render(Settings);
	await user.click(view.getByRole('button', { name: 'Reset feature tours' }));
	expect(
		await view.findByText(
			'Reset. Empty-state help links and first-use tour invitations are available again.'
		)
	).toBeTruthy();
	for (const identifier of [
		'dictionary',
		'reader-library',
		'reader-document',
		'flashcards',
		'quiz',
	]) {
		expect(walkthroughStore.preferences.guides[identifier]).toBeUndefined();
	}
	expect(preferenceManager.set).toHaveBeenCalledWith(
		'walkthrough',
		expect.objectContaining({
			featureInvitations: {},
		})
	);
});

it('hides feature-tour reset in release builds', async () => {
	vi.spyOn(settings, 'isDevBuild').mockReturnValue(false);
	vi.spyOn(settings, 'resolveIsDevBuild').mockResolvedValue(false);
	const view = render(Settings);
	await waitFor(() => expect(settings.resolveIsDevBuild).toHaveBeenCalled());
	expect(view.queryByRole('button', { name: 'Reset feature tours' })).toBeNull();
});

it('groups settings by purpose with Help first and developer tools last', async () => {
	const view = render(Settings);
	const general = view.getByRole('tabpanel', { name: 'General' });
	expect(
		within(general)
			.getAllByRole('heading', { level: 2 })
			.map((heading) => heading.textContent)
	).toEqual(['Help & Maintenance', 'Chinese & Dictionary', 'Appearance', 'Developer']);
	expect(
		within(view.getByRole('region', { name: 'Help & Maintenance' })).getByRole('group', {
			name: 'Walkthrough',
		})
	).toBeTruthy();
	expect(
		within(view.getByRole('region', { name: 'Chinese & Dictionary' })).getByRole('heading', {
			name: 'Dictionary details',
		})
	).toBeTruthy();
	expect(
		within(view.getByRole('region', { name: 'Appearance' })).getByRole('checkbox', {
			name: 'Increase Contrast',
		})
	).toBeTruthy();
	expect(
		within(view.getByRole('region', { name: 'Developer' })).getByRole('button', {
			name: 'Reset feature tours',
		})
	).toBeTruthy();
	const hsk = general.querySelector('fieldset.hsk-variant-selector');
	expect(
		document
			.getElementById(hsk.getAttribute('aria-describedby'))
			.textContent.replace(/\s+/g, ' ')
	).toContain('level labels shown on dictionary entries');
});

it('remembers General scroll across tab switches and route remounts', async () => {
	const user = userEvent.setup();
	vi.mocked(invoke).mockImplementation(async (command) =>
		command === 'get_acknowledgements'
			? []
			: command === 'read_bookmark_recovery_report'
				? null
				: false
	);
	const view = render(Settings);
	await waitFor(() => expect(view.getByRole('heading', { name: 'Developer' })).toBeTruthy());
	const scroller = view.container.querySelector('.settings--content');
	scroller.scrollTop = 420;
	await fireEvent.scroll(scroller);
	await user.click(view.getByRole('tab', { name: 'Acknowledgements' }));
	expect(view.container.querySelector('.settings--content').scrollTop).toBe(0);
	await user.click(view.getByRole('tab', { name: 'General' }));
	await waitFor(() =>
		expect(view.container.querySelector('.settings--content').scrollTop).toBe(420)
	);
	view.unmount();
	const reopened = render(Settings);
	await waitFor(() =>
		expect(reopened.container.querySelector('.settings--content').scrollTop).toBe(420)
	);
});

it('omits the entire Developer group and navigation choice in release builds', async () => {
	vi.spyOn(settings, 'isDevBuild').mockReturnValue(false);
	vi.spyOn(settings, 'resolveIsDevBuild').mockResolvedValue(false);
	const user = userEvent.setup();
	const view = render(Settings);
	await waitFor(() => expect(settings.resolveIsDevBuild).toHaveBeenCalled());
	expect(view.queryByRole('region', { name: 'Developer' })).toBeNull();
	expect(view.queryByRole('button', { name: 'Developer' })).toBeNull();
	await user.click(view.getByRole('button', { name: 'Jump to section' }));
	expect(view.queryByRole('menuitemradio', { name: 'Developer' })).toBeNull();
});

it('hides the updater in Mac App Store builds', async () => {
	vi.spyOn(settings, 'resolveIsMasBuild').mockResolvedValue(true);
	const view = render(Settings);
	await waitFor(() => expect(settings.resolveIsMasBuild).toHaveBeenCalled());
	expect(view.queryByRole('heading', { name: 'Updates' })).toBeNull();
});
