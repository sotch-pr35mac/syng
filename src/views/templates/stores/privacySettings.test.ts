import { beforeEach, expect, it, vi } from 'vitest';

const telemetry = vi.hoisted(() => ({
	setPref: vi.fn(() => Promise.resolve()),
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
}));

vi.mock('@/utils/telemetry.js', () => ({
	telemetry,
}));

let privacySettingsStore: typeof import('@/stores/privacySettings.svelte.js').privacySettingsStore;
let setPreferenceManagerForTest: typeof import('@/utils/appServices.js').setPreferenceManagerForTest;
type PreferenceManagerForTest = Parameters<typeof setPreferenceManagerForTest>[0];

const buildPreferenceManager = (preferences: Record<string, unknown> = {}) => ({
	waitForInit: vi.fn(() => Promise.resolve()),
	get: vi.fn((name: string) => preferences[name]),
	set: vi.fn((name: string, value: unknown) => {
		preferences[name] = value;
	}),
});

beforeEach(async () => {
	vi.resetModules();
	telemetry.setPref.mockClear();
	({ setPreferenceManagerForTest } = await import('@/utils/appServices.js'));
	({ privacySettingsStore } = await import('@/stores/privacySettings.svelte.js'));
});

it('loads persisted privacy settings', async () => {
	const preferenceManager = buildPreferenceManager({
		childPrivacyMode: true,
		completedOnboardingVersion: 1,
	});
	setPreferenceManagerForTest(preferenceManager as unknown as PreferenceManagerForTest);

	await privacySettingsStore.loadSettings();

	expect(privacySettingsStore.childPrivacyMode).toBe(true);
	expect(privacySettingsStore.completedOnboardingVersion).toBe(1);
	expect(privacySettingsStore.forceOnboardingReplay).toBe(false);
	expect(privacySettingsStore.hasCompletedOnboarding).toBe(true);
});

it('forces telemetry off when entering child privacy mode and restores default-on when leaving', async () => {
	const preferenceManager = buildPreferenceManager({
		childPrivacyMode: false,
		completedOnboardingVersion: 0,
	});
	setPreferenceManagerForTest(preferenceManager as unknown as PreferenceManagerForTest);

	await privacySettingsStore.setChildPrivacyMode(true);

	expect(preferenceManager.set).toHaveBeenCalledWith('childPrivacyMode', true);
	expect(telemetry.setPref).toHaveBeenCalledWith('enabled', false);

	await privacySettingsStore.setChildPrivacyMode(false);

	expect(preferenceManager.set).toHaveBeenCalledWith('childPrivacyMode', false);
	expect(telemetry.setPref).toHaveBeenCalledWith('enabled', true);
});

it('does not treat child privacy mode as an alias for the telemetry flag when already eligible', async () => {
	const preferenceManager = buildPreferenceManager();
	setPreferenceManagerForTest(preferenceManager as unknown as PreferenceManagerForTest);

	await privacySettingsStore.setChildPrivacyMode(false);

	expect(telemetry.setPref).not.toHaveBeenCalled();
});

it('uses the completed version without retaining a region', async () => {
	const preferences: Record<string, unknown> = {
		completedOnboardingVersion: 1,
		forceOnboardingReplay: false,
	};
	const preferenceManager = buildPreferenceManager(preferences);
	setPreferenceManagerForTest(preferenceManager as unknown as PreferenceManagerForTest);

	await privacySettingsStore.loadSettings();

	expect(preferenceManager.set).not.toHaveBeenCalled();
	expect(privacySettingsStore.completedOnboardingVersion).toBe(1);
	expect(privacySettingsStore.hasCompletedOnboarding).toBe(true);
});

it('replays onboarding without wiping other privacy settings', async () => {
	const preferences: Record<string, unknown> = {
		completedOnboardingVersion: 1,
		forceOnboardingReplay: false,
	};
	const preferenceManager = buildPreferenceManager(preferences);
	setPreferenceManagerForTest(preferenceManager as unknown as PreferenceManagerForTest);
	privacySettingsStore.setPrivacySettingsForTest({
		completedOnboardingVersion: 1,
		forceOnboardingReplay: false,
	});

	privacySettingsStore.requestOnboardingReplay();

	expect(preferenceManager.set).toHaveBeenCalledWith('forceOnboardingReplay', true);
	expect(privacySettingsStore.completedOnboardingVersion).toBe(1);
	expect(privacySettingsStore.hasCompletedOnboarding).toBe(false);

	await privacySettingsStore.loadSettings();

	expect(privacySettingsStore.completedOnboardingVersion).toBe(1);
	expect(privacySettingsStore.forceOnboardingReplay).toBe(true);
	expect(privacySettingsStore.hasCompletedOnboarding).toBe(false);

	privacySettingsStore.completeOnboarding();

	expect(preferenceManager.set).toHaveBeenCalledWith('forceOnboardingReplay', false);
	expect(privacySettingsStore.hasCompletedOnboarding).toBe(true);
});
