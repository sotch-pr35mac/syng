import { hasCompletedCurrentOnboarding, ONBOARDING_VERSION } from '@/types/onboarding.js';
import type { PrivacySettings } from '@/types/privacy.js';
import { getPreferenceManager } from '@/utils/appServices.js';
import { childPrivacyModeFrom } from '@/utils/privacyPolicy.js';
import { telemetry } from '@/utils/telemetry.js';

const DEFAULT_PRIVACY_SETTINGS: PrivacySettings = {
	childPrivacyMode: false,
	completedOnboardingVersion: 0,
	forceOnboardingReplay: false,
};

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
	} catch {
		childPrivacyMode = DEFAULT_PRIVACY_SETTINGS.childPrivacyMode;
		completedOnboardingVersion = DEFAULT_PRIVACY_SETTINGS.completedOnboardingVersion;
		forceOnboardingReplay = DEFAULT_PRIVACY_SETTINGS.forceOnboardingReplay;
	}
}

async function setChildPrivacyMode(nextChildPrivacyMode: boolean): Promise<void> {
	const wasChildPrivacyMode = childPrivacyMode;
	if (nextChildPrivacyMode) {
		// Apply the native telemetry restriction before publishing/persisting child mode so
		// onboarding cannot complete while the privacy write is still in flight.
		await telemetry.setPref('enabled', false);
	} else if (wasChildPrivacyMode) {
		await telemetry.setPref('enabled', true);
	}
	childPrivacyMode = nextChildPrivacyMode;
	getPreferenceManager().set('childPrivacyMode', nextChildPrivacyMode);
}

async function applyAgeClassification(
	regionCode: string | null,
	isBelowApplicableAge: boolean | null
): Promise<void> {
	await setChildPrivacyMode(childPrivacyModeFrom(regionCode, isBelowApplicableAge));
}

async function resetAgeClassification(): Promise<void> {
	// A new region intentionally resets telemetry to its default. Await this before accepting an
	// age answer so this enable cannot finish after a subsequent child-mode disable.
	await telemetry.setPref('enabled', true);
	childPrivacyMode = false;
	getPreferenceManager().set('childPrivacyMode', false);
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
	childPrivacyMode = settings.childPrivacyMode ?? DEFAULT_PRIVACY_SETTINGS.childPrivacyMode;
	completedOnboardingVersion =
		settings.completedOnboardingVersion ?? DEFAULT_PRIVACY_SETTINGS.completedOnboardingVersion;
	forceOnboardingReplay =
		settings.forceOnboardingReplay ?? DEFAULT_PRIVACY_SETTINGS.forceOnboardingReplay;
}

export const privacySettingsStore = {
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
	setChildPrivacyMode,
	applyAgeClassification,
	resetAgeClassification,
	completeOnboarding,
	requestOnboardingReplay,
	setPrivacySettingsForTest,
};
