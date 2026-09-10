import { ONBOARDING_STEPS, type OnboardingStepId } from '@/types/onboarding.js';
import { privacySettingsStore } from '@/stores/privacySettings.svelte.js';
import { isPrivacyStepComplete, normalizeRegionCode } from '@/utils/privacyPolicy.js';

let currentStepIndex = $state(0);
let regionCode = $state<string | null>(null);
let isBelowApplicableAge = $state<boolean | null>(null);
let applyingRegionSelection = $state(false);
let regionSelectionApplied = $state(false);
let applyingAgeClassification = $state(false);
let ageClassificationApplied = $state(false);

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

async function setIsBelowApplicableAge(value: boolean | null): Promise<void> {
	isBelowApplicableAge = value;
	ageClassificationApplied = false;
	applyingAgeClassification = true;
	try {
		await privacySettingsStore.applyAgeClassification(regionCode, value);
		ageClassificationApplied = true;
	} finally {
		applyingAgeClassification = false;
	}
}

async function selectRegion(nextRegionCode: string): Promise<void> {
	regionCode = normalizeRegionCode(nextRegionCode);
	isBelowApplicableAge = null;
	regionSelectionApplied = false;
	ageClassificationApplied = false;
	applyingRegionSelection = true;
	try {
		await privacySettingsStore.resetAgeClassification();
		regionSelectionApplied = true;
	} catch (error) {
		regionCode = null;
		throw error;
	} finally {
		applyingRegionSelection = false;
	}
}

function reset(): void {
	currentStepIndex = 0;
	regionCode = null;
	isBelowApplicableAge = null;
	applyingRegionSelection = false;
	regionSelectionApplied = false;
	applyingAgeClassification = false;
	ageClassificationApplied = false;
}

export const onboardingStore = {
	get currentStepIndex(): number {
		return currentStepIndex;
	},
	get currentStepId(): OnboardingStepId {
		return ONBOARDING_STEPS[currentStepIndex].id;
	},
	get regionCode(): string | null {
		return regionCode;
	},
	get isBelowApplicableAge(): boolean | null {
		return isBelowApplicableAge;
	},
	get applyingAgeClassification(): boolean {
		return applyingAgeClassification;
	},
	get applyingRegionSelection(): boolean {
		return applyingRegionSelection;
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
		if (
			!regionSelectionApplied ||
			applyingRegionSelection ||
			!isPrivacyStepComplete(regionCode, isBelowApplicableAge)
		) {
			return false;
		}
		return (
			isBelowApplicableAge === null ||
			(ageClassificationApplied && !applyingAgeClassification)
		);
	},
	nextStep,
	previousStep,
	setIsBelowApplicableAge,
	selectRegion,
	reset,
};
