/** Survey commands report operational failures without putting answers into diagnostics. */
import { invoke } from '@tauri-apps/api/core';
import { NATIVE_COMMANDS } from '@/types/nativeCommands.js';
import type { SurveyAnswers } from '@/types/onboardingSurvey.js';
import { handleError } from '@/utils/error.js';

/** Resume queued delivery. Callers may ignore failure so startup remains available. */
export function initializeSurvey(): Promise<void> {
	return runSurveyCommand(NATIVE_COMMANDS.SURVEY.INIT);
}

/**
 * Queue answers only after explicit sharing; resolution means saved locally, not delivered.
 * Reports controlled diagnostics through the normal error handler, then rejects on failure
 * so the caller retains control of onboarding. Never forward answers or raw errors to logs.
 */
export function submitSurvey(answers: SurveyAnswers): Promise<void> {
	return runSurveyCommand(NATIVE_COMMANDS.SURVEY.SUBMIT, { answers });
}

async function runSurveyCommand(
	command: typeof NATIVE_COMMANDS.SURVEY.INIT | typeof NATIVE_COMMANDS.SURVEY.SUBMIT,
	args?: { answers: SurveyAnswers }
): Promise<void> {
	try {
		await invoke(command, args);
	} catch (error) {
		// Native currently returns controlled codes. Still allowlist at this boundary:
		// bridge/platform errors may contain arbitrary data and must not reach logs.
		handleError(
			'Survey operation failed.',
			{
				operation: command,
				code: error === 'invalid_input' ? 'invalid_input' : 'unavailable',
			},
			{ silent: true, context: { operation: command } }
		);
		throw error;
	}
}
