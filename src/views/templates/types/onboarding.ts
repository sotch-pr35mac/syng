export const ONBOARDING_VERSION = 3;

export const ONBOARDING_STEPS = [
	{ id: 'welcome', introducedIn: 1 },
	{ id: 'chinese_preferences', introducedIn: 1 },
	{ id: 'about_you', introducedIn: 3 },
	{ id: 'privacy', introducedIn: 1 },
	{ id: 'interview', introducedIn: 2 },
] as const;

export type OnboardingStepId = (typeof ONBOARDING_STEPS)[number]['id'];

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

// Returning users receive the new survey only; the interview remains a first-run invitation.
export function pendingOnboardingSteps(completedVersion: number): OnboardingStep[] {
	return ONBOARDING_STEPS.filter(
		(step) =>
			step.introducedIn > completedVersion &&
			(completedVersion === 0 || step.id !== 'interview')
	);
}

export function hasCompletedCurrentOnboarding(completedVersion: number): boolean {
	return pendingOnboardingSteps(completedVersion).length === 0;
}
