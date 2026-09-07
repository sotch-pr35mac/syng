export const ONBOARDING_VERSION = 1;

export const ONBOARDING_STEPS = [
	{ id: 'welcome', introducedIn: 1 },
	{ id: 'chinese_preferences', introducedIn: 1 },
	{ id: 'privacy', introducedIn: 1 },
] as const;

export type OnboardingStepId = (typeof ONBOARDING_STEPS)[number]['id'];

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export function pendingOnboardingSteps(completedVersion: number): OnboardingStep[] {
	return ONBOARDING_STEPS.filter((step) => step.introducedIn > completedVersion);
}

export function hasCompletedCurrentOnboarding(completedVersion: number): boolean {
	return pendingOnboardingSteps(completedVersion).length === 0;
}
