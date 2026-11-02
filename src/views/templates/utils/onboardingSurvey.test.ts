import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { initializeSurvey, submitSurvey } from '@/utils/onboardingSurvey.js';
import { telemetry } from '@/utils/telemetry.js';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('@/utils/telemetry.js', () => ({ telemetry: { trackError: vi.fn() } }));
vi.mock('@/utils/appLifecycle.js', () => ({ getResumeContext: () => ({}) }));

beforeEach(() => {
	vi.mocked(invoke).mockReset();
	vi.mocked(telemetry.trackError).mockReset().mockResolvedValue(undefined);
	vi.spyOn(console, 'error').mockImplementation(() => {});
	vi.spyOn(globalThis, 'alert').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

it.each(['initialize', 'submit'] as const)(
	'reports %s failures without exposing raw errors or survey answers',
	async (operation) => {
		const failure = { message: 'private response', submission_id: 'private-id' };
		vi.mocked(invoke).mockRejectedValue(failure);
		const pending =
			operation === 'initialize'
				? initializeSurvey()
				: submitSurvey({ goals: ['something_else'], goals_other: 'private answer' });
		await expect(pending).rejects.toBe(failure);
		expect(telemetry.trackError).toHaveBeenCalledWith(
			'app.error',
			'Survey operation failed.',
			expect.objectContaining({
				operation: `survey_${operation === 'initialize' ? 'init' : 'submit'}`,
				code: 'unavailable',
			})
		);
		const diagnostics = JSON.stringify([
			vi.mocked(console.error).mock.calls,
			vi.mocked(telemetry.trackError).mock.calls,
		]);
		expect(diagnostics).not.toMatch(
			/private response|private-id|private answer|something_else/
		);
		expect(globalThis.alert).not.toHaveBeenCalled();
	}
);

it('preserves controlled validation codes even when telemetry reporting fails', async () => {
	vi.mocked(invoke).mockRejectedValue('invalid_input');
	vi.mocked(telemetry.trackError).mockRejectedValue(new Error('telemetry unavailable'));
	await expect(submitSurvey({})).rejects.toBe('invalid_input');
	expect(telemetry.trackError).toHaveBeenCalledWith(
		'app.error',
		'Survey operation failed.',
		expect.objectContaining({ code: 'invalid_input' })
	);
	expect(globalThis.alert).not.toHaveBeenCalled();
});

it('queues successful answers without creating diagnostic events', async () => {
	vi.mocked(invoke).mockResolvedValue(undefined);
	const answers = { goals: ['something_else'], goals_other: 'Read menus' };
	await initializeSurvey();
	await submitSurvey(answers);
	expect(invoke).toHaveBeenCalledWith('survey_submit', { answers });
	expect(telemetry.trackError).not.toHaveBeenCalled();
	expect(console.error).not.toHaveBeenCalled();
});
