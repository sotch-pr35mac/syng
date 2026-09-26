import { invoke } from '@tauri-apps/api/core';
import { NATIVE_COMMANDS } from '@/types/nativeCommands.js';

// Keep this immutable: the server records this version as evidence of the copy shown.
export const INTERVIEW_CONSENT = {
	version: 'interviews-v1',
	title: 'Help shape Syng',
	invitation:
		'Would you be interested in a scheduled, 30-minute interview in English about your experience using Syng? We’d like to hear what you use most, what works well, what could be better, and which features you’d like to see. Participation is optional, and we’ll arrange a time by email if we invite you.',
	linkage:
		'We’ll link your name and email to this installation’s telemetry ID. This lets us review previously collected usage data and any future usage data allowed by your telemetry settings to select participants and prepare interviews. Signing up won’t change your telemetry settings.',
	retention:
		'Your signup stays active for 365 days. Expired records are removed automatically, usually within a few additional days. To withdraw or correct your details sooner, email hello@bytecraft.xyz. We’ll use your details only for interview research, not marketing.',
	checkbox:
		'I agree to be contacted about Syng interviews and to this use of my linked telemetry.',
} as const;

export interface InterviewSignup {
	signup_id: string;
	preferred_name: string;
	email: string;
	consent: boolean;
	consent_version: typeof INTERVIEW_CONSENT.version;
}

export function submitInterviewSignup(signup: InterviewSignup): Promise<void> {
	return invoke(NATIVE_COMMANDS.INTERVIEWS.SIGNUP, { signup });
}

// Never display, log, or forward arbitrary native/server errors: they may contain input.
export function interviewErrorMessage(error: unknown): string {
	if (error === 'rate_limited') {
		return 'Too many attempts. Please try again later, or skip to start using Syng.';
	}
	if (error === 'invalid_input') {
		return 'Check your name, email address, and consent, then try again.';
	}
	return 'We couldn’t confirm your signup. Try again, or skip to start using Syng. If it was received, you can withdraw by emailing hello@bytecraft.xyz.';
}
