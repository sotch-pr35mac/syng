import { invoke } from '@tauri-apps/api/core';
import { NATIVE_COMMANDS } from '@/types/nativeCommands.js';
import type { SurveyAnswers } from '@/types/onboardingSurvey.js';
export function initializeSurvey(): Promise<void> {
	return invoke(NATIVE_COMMANDS.SURVEY.INIT);
}
/** Only call after explicit sharing. Errors must never be logged or forwarded to telemetry. */
export function submitSurvey(answers: SurveyAnswers): Promise<void> {
	return invoke(NATIVE_COMMANDS.SURVEY.SUBMIT, { answers });
}
