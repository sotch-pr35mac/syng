import { ONBOARDING_STEPS, type OnboardingStepId } from '@/types/onboarding.js';
import { privacySettingsStore } from '@/stores/privacySettings.svelte.js';
import { isPrivacyStepComplete } from '@/utils/privacyPolicy.js';
import { telemetry } from '@/utils/telemetry.js';

let currentStepIndex = $state(0);
let isBelowApplicableAge = $state<boolean | null>(null);

function nextStep(): void {
	if (currentStepIndex < ONBOARDING_STEPS.length - 1) {
		currentStepIndex += 1;
	}
}

function previousStep(): void {
	if (currentStepIndex > 0) {
		currentStepIndex -= 1;
	}
}

function setIsBelowApplicableAge(value: boolean | null): void {
	isBelowApplicableAge = value;
	privacySettingsStore.applyAgeClassification(value);
}

function selectRegion(nextRegionCode: string): void {
	isBelowApplicableAge = null;
	privacySettingsStore.setRegionCode(nextRegionCode);
	privacySettingsStore.applyAgeClassification(null);
	telemetry.setPref('enabled', true).catch(() => {});
}

function reset(): void {
	currentStepIndex = 0;
	isBelowApplicableAge = null;
}

export const onboardingStore = {
	get currentStepIndex(): number {
		return currentStepIndex;
	},
	get currentStepId(): OnboardingStepId {
		return ONBOARDING_STEPS[currentStepIndex].id;
	},
	get isBelowApplicableAge(): boolean | null {
		return isBelowApplicableAge;
	},
	get isFirstStep(): boolean {
		return currentStepIndex === 0;
	},
	get isLastStep(): boolean {
		return currentStepIndex === ONBOARDING_STEPS.length - 1;
	},
	get canContinue(): boolean {
		if (ONBOARDING_STEPS[currentStepIndex].id !== 'privacy') {
			return true;
		}
		return isPrivacyStepComplete(privacySettingsStore.regionCode, isBelowApplicableAge);
	},
	nextStep,
	previousStep,
	setIsBelowApplicableAge,
	selectRegion,
	reset,
};
