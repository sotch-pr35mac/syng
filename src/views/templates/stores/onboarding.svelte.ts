import { pendingOnboardingSteps, type OnboardingStepId } from '@/types/onboarding.js';
import { privacySettingsStore } from '@/stores/privacySettings.svelte.js';
import { isPrivacyStepComplete, normalizeRegionCode } from '@/utils/privacyPolicy.js';

import { getPreferenceManager } from '@/utils/appServices.js';
import { SURVEY_SCHEMA_VERSION, type SurveyAnswers } from '@/types/onboardingSurvey.js';
let surveyCompletedAtStart = $state(false);
let surveyQuestionIndex = $state(0);
let surveyAnswers = $state<SurveyAnswers>({});
let currentStepIndex = $state(0);
let regionCode = $state<string | null>(null);
let isBelowApplicableAge = $state<boolean | null>(null);
let applyingRegionSelection = $state(false);
let regionSelectionApplied = $state(false);
let applyingAgeClassification = $state(false);
let ageClassificationApplied = $state(false);
let startingVersion = $state(0);
const steps = $derived(
	pendingOnboardingSteps(startingVersion).filter(
		(step) =>
			(step.id !== 'interview' || !privacySettingsStore.childPrivacyMode) &&
			(step.id !== 'about_you' || !surveyCompletedAtStart)
	)
);

function nextStep(): void {
	if (currentStepIndex < steps.length - 1) {
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
	startingVersion = privacySettingsStore.forceOnboardingReplay
		? 0
		: privacySettingsStore.completedOnboardingVersion;
	surveyCompletedAtStart =
		!privacySettingsStore.forceOnboardingReplay &&
		getPreferenceManager().get('completedAboutYouVersion') === SURVEY_SCHEMA_VERSION;
	surveyQuestionIndex = 0;
	surveyAnswers = {};
	currentStepIndex = 0;
	regionCode = null;
	isBelowApplicableAge = null;
	applyingRegionSelection = false;
	regionSelectionApplied = false;
	applyingAgeClassification = false;
	ageClassificationApplied = false;
}

export const onboardingStore = {
	get surveyQuestionIndex() {
		return surveyQuestionIndex;
	},
	set surveyQuestionIndex(value: number) {
		surveyQuestionIndex = value;
	},
	get surveyAnswers() {
		return surveyAnswers;
	},
	set surveyAnswers(value: SurveyAnswers) {
		surveyAnswers = value;
	},
	async completeSurvey() {
		const preferences = getPreferenceManager();
		preferences.set('completedAboutYouVersion', SURVEY_SCHEMA_VERSION);
		await preferences.waitForPendingWrites?.();
	},
	get steps() {
		return steps;
	},
	get currentStepIndex(): number {
		return currentStepIndex;
	},
	get currentStepId(): OnboardingStepId | null {
		return steps[currentStepIndex]?.id ?? null;
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
		return currentStepIndex >= steps.length - 1;
	},
	get canContinue(): boolean {
		if (steps[currentStepIndex]?.id !== 'privacy') {
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
