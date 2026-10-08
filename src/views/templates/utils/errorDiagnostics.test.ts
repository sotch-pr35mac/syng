import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { describeUnknownError, formatErrorDetails, handleError } from '@/utils/error.js';
import { telemetry } from '@/utils/telemetry.js';

vi.mock('@/utils/telemetry.js', () => ({
	telemetry: { trackError: vi.fn(async () => undefined) },
}));

beforeEach(() => {
	vi.useFakeTimers();
	vi.mocked(telemetry.trackError).mockClear();
	vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
});

it('extracts JS and native causes and private context for the Rust privacy boundary', async () => {
	const nativeError = {
		name: 'UpdaterError',
		message: 'could not connect',
		code: 'connect',
		status: 503,
		cause: {
			message: 'secret title https://example.test/private',
			document_title: 'secret title',
		},
	};
	const error = new Error('Update operation failed', { cause: nativeError });
	handleError('Could not update', error, {
		silent: true,
		context: { operation: 'updater', stage: 'check', duration_ms: 25 },
	});
	await vi.advanceTimersByTimeAsync(0);
	expect(telemetry.trackError).toHaveBeenCalledWith(
		'app.error',
		'Could not update',
		expect.objectContaining({
			operation: 'updater',
			stage: 'check',
			duration_ms: 25,
			visibility_state: expect.any(String),
			ms_since_foreground: expect.any(Number),
			error_causes: [
				expect.objectContaining({
					error_name: 'UpdaterError',
					error_message: 'could not connect',
					code: 'connect',
					status: 503,
				}),
				expect.objectContaining({
					error_message: 'secret title https://example.test/private',
					document_title: 'secret title',
				}),
			],
		})
	);
	// An outer UI catch can still alert without reporting this failure again.
	handleError('User-facing failure', new Error('wrapped', { cause: error }), { silent: true });
	await vi.advanceTimersByTimeAsync(30_000);
	expect(telemetry.trackError).toHaveBeenCalledTimes(1);
});

it('keeps alerts simple while reporting detailed errors and nested stacks', () => {
	const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
	const databaseError = Object.assign(new Error('Unable to open database'), {
		reason: 'Permission denied',
		code: 'DB_OPEN',
		status: 500,
	});
	const error = Object.assign(new Error('Loading preferences', { cause: databaseError }), {
		reason: 'Initialization failed',
	});

	handleError('Please restart Syng.', error);

	expect(alertSpy).toHaveBeenCalledExactlyOnceWith('Please restart Syng.');
	expect(telemetry.trackError).toHaveBeenCalledWith(
		'app.error',
		'Please restart Syng.',
		expect.objectContaining({
			error_message: 'Loading preferences',
			error_reason: 'Initialization failed',
			error_stack: expect.any(String),
			error_causes: [
				expect.objectContaining({
					error_message: 'Unable to open database',
					error_reason: 'Permission denied',
					error_stack: expect.any(String),
					code: 'DB_OPEN',
					status: 500,
				}),
			],
		})
	);
});

it('handles circular causes and primitive rejections', () => {
	const error = new Error('cyclic');
	error.cause = error;
	expect(describeUnknownError(error).error_causes).toBeUndefined();
	expect(
		describeUnknownError(new Error('outer', { cause: 'native failure' })).error_causes
	).toEqual([{ error_message: 'native failure' }]);
	expect(
		describeUnknownError({
			message: 'db closed',
			name: 'DatabaseError',
			status: 409,
			code: 'CLOSED',
		})
	).toMatchObject({
		error_message: 'db closed',
		error_name: 'DatabaseError',
		status: 409,
		code: 'CLOSED',
	});
});

it('formats nested database and native errors without exposing arbitrary payload fields', () => {
	expect(
		formatErrorDetails(
			new Error('Loading preferences', {
				cause: {
					name: 'UnknownError',
					message: 'Unable to open database',
					status: 500,
					document: 'private content',
				},
			})
		)
	).toBe(
		'Error: Loading preferences\nCaused by: UnknownError: Unable to open database: status: 500'
	);
	expect(formatErrorDetails('native failure')).toBe('native failure');
	expect(
		formatErrorDetails({
			name: 'indexed_db_went_bad',
			message: 'unknown',
			reason: 'Permission denied',
		})
	).toContain('reason: Permission denied');
	expect(formatErrorDetails(undefined)).toBe('');
	const cyclicError = new Error('cyclic');
	cyclicError.cause = cyclicError;
	expect(formatErrorDetails(cyclicError)).toBe('Error: cyclic');
});
