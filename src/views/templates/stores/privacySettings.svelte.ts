import { hasCompletedCurrentOnboarding, ONBOARDING_VERSION } from '@/types/onboarding.js';
import type { PrivacySettings } from '@/types/privacy.js';
import { getPreferenceManager } from '@/utils/appServices.js';
import { childPrivacyModeFrom, normalizeRegionCode } from '@/utils/privacyPolicy.js';
import { telemetry } from '@/utils/telemetry.js';

const DEFAULT_PRIVACY_SETTINGS: PrivacySettings = {
	regionCode: null,
	childPrivacyMode: false,
	completedOnboardingVersion: 0,
	forceOnboardingReplay: false,
};

let regionCode = $state<string | null>(DEFAULT_PRIVACY_SETTINGS.regionCode);
let childPrivacyMode = $state(DEFAULT_PRIVACY_SETTINGS.childPrivacyMode);
let completedOnboardingVersion = $state(DEFAULT_PRIVACY_SETTINGS.completedOnboardingVersion);
let forceOnboardingReplay = $state(DEFAULT_PRIVACY_SETTINGS.forceOnboardingReplay);

function normalizeCompletedVersion(value: unknown): number {
	return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
	return typeof value === 'boolean' ? value : fallback;
}

async function loadSettings(): Promise<void> {
	try {
		const preferenceManager = getPreferenceManager();
		await preferenceManager.waitForInit();
		regionCode = normalizeRegionCode(preferenceManager.get('regionCode') as string | null);
		childPrivacyMode = normalizeBoolean(
			preferenceManager.get('childPrivacyMode'),
			DEFAULT_PRIVACY_SETTINGS.childPrivacyMode
		);
		completedOnboardingVersion = normalizeCompletedVersion(
			preferenceManager.get('completedOnboardingVersion')
		);
		forceOnboardingReplay = normalizeBoolean(
			preferenceManager.get('forceOnboardingReplay'),
			DEFAULT_PRIVACY_SETTINGS.forceOnboardingReplay
		);
		// Completing v1 always persists a region. A version without one means the user
		// never finished onboarding (including installs auto-marked complete).
		if (completedOnboardingVersion > 0 && !regionCode) {
			completedOnboardingVersion = 0;
			preferenceManager.set('completedOnboardingVersion', 0);
		}
	} catch {
		regionCode = DEFAULT_PRIVACY_SETTINGS.regionCode;
		childPrivacyMode = DEFAULT_PRIVACY_SETTINGS.childPrivacyMode;
		completedOnboardingVersion = DEFAULT_PRIVACY_SETTINGS.completedOnboardingVersion;
		forceOnboardingReplay = DEFAULT_PRIVACY_SETTINGS.forceOnboardingReplay;
	}
}

function setRegionCode(nextRegionCode: string | null): void {
	regionCode = normalizeRegionCode(nextRegionCode);
	getPreferenceManager().set('regionCode', regionCode);
}

function setChildPrivacyMode(nextChildPrivacyMode: boolean): void {
	const wasChildPrivacyMode = childPrivacyMode;
	childPrivacyMode = nextChildPrivacyMode;
	getPreferenceManager().set('childPrivacyMode', nextChildPrivacyMode);
	if (nextChildPrivacyMode) {
		telemetry.setPref('enabled', false).catch(() => {});
		return;
	}
	if (wasChildPrivacyMode) {
		telemetry.setPref('enabled', true).catch(() => {});
	}
}

function applyAgeClassification(isBelowApplicableAge: boolean | null): void {
	setChildPrivacyMode(childPrivacyModeFrom(regionCode, isBelowApplicableAge));
}

function completeOnboarding(): void {
	const preferenceManager = getPreferenceManager();
	completedOnboardingVersion = ONBOARDING_VERSION;
	forceOnboardingReplay = false;
	if (preferenceManager.get('forceOnboardingReplay')) {
		preferenceManager.set('forceOnboardingReplay', false);
	}
	if (preferenceManager.get('completedOnboardingVersion') !== ONBOARDING_VERSION) {
		preferenceManager.set('completedOnboardingVersion', ONBOARDING_VERSION);
	}
}

/**
 * Dev/QA: show first-run onboarding again without wiping bookmarks or reader documents.
 */
function requestOnboardingReplay(): void {
	forceOnboardingReplay = true;
	getPreferenceManager().set('forceOnboardingReplay', true);
}

function setPrivacySettingsForTest(settings: Partial<PrivacySettings>): void {
	regionCode =
		settings.regionCode !== undefined
			? normalizeRegionCode(settings.regionCode)
			: DEFAULT_PRIVACY_SETTINGS.regionCode;
	childPrivacyMode = settings.childPrivacyMode ?? DEFAULT_PRIVACY_SETTINGS.childPrivacyMode;
	completedOnboardingVersion =
		settings.completedOnboardingVersion ?? DEFAULT_PRIVACY_SETTINGS.completedOnboardingVersion;
	forceOnboardingReplay =
		settings.forceOnboardingReplay ?? DEFAULT_PRIVACY_SETTINGS.forceOnboardingReplay;
}

export const privacySettingsStore = {
	get regionCode(): string | null {
		return regionCode;
	},
	get childPrivacyMode(): boolean {
		return childPrivacyMode;
	},
	get completedOnboardingVersion(): number {
		return completedOnboardingVersion;
	},
	get forceOnboardingReplay(): boolean {
		return forceOnboardingReplay;
	},
	get hasCompletedOnboarding(): boolean {
		return !forceOnboardingReplay && hasCompletedCurrentOnboarding(completedOnboardingVersion);
	},
	loadSettings,
	setRegionCode,
	setChildPrivacyMode,
	applyAgeClassification,
	completeOnboarding,
	requestOnboardingReplay,
	setPrivacySettingsForTest,
};
