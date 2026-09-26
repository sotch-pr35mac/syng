import { invoke } from '@tauri-apps/api/core';
import { NATIVE_COMMANDS } from '@/types/nativeCommands.js';

// This notice is still unreleased. Freeze its copy/version when interviews-v1 ships.
export const INTERVIEW_CONSENT = {
	version: 'interviews-v1',
	title: 'Help Shape Syng',
	invitation:
		"We value your opinion. Join an optional 30-minute interview in English about your experience using Syng. If selected, we'll email you to arrange a time.",
	checkbox: 'I agree to be contacted about Syng interviews as described in the',
} as const;

export interface InterviewSignup {
	signup_id: string;
	preferred_name: string;
	email: string;
	consent: boolean;
	consent_version: typeof INTERVIEW_CONSENT.version;
}

export function submitInterviewSignup(signup: InterviewSignup): Promise<void> {
	// Resolves after durable local storage; delivery does not hold up onboarding.
	return invoke(NATIVE_COMMANDS.INTERVIEWS.SIGNUP, { signup });
}

export function initializeInterviews(childPrivacyMode: boolean): Promise<void> {
	return invoke(NATIVE_COMMANDS.INTERVIEWS.INIT, { childPrivacyMode });
}

// Never display, log, or forward arbitrary native/server errors: they may contain input.
export function interviewErrorMessage(error: unknown): string {
	if (error === 'invalid_input') {
		return 'Check your name, email address, and consent, then try again.';
	}
	return 'Your signup couldn’t be saved on this device. Try again, or skip to start using Syng.';
}
