import { telemetry } from '@/utils/telemetry.js';
import { getResumeContext } from '@/utils/appLifecycle.js';

const reportedErrors = new WeakSet();
const MAX_ERROR_CAUSES = 5;

export function markErrorReported(error) {
	if (error && typeof error === 'object') {
		reportedErrors.add(error);
	}
	return error;
}

function wasReported(error) {
	const visited = new WeakSet();
	let current = error;
	while (current && typeof current === 'object' && !visited.has(current)) {
		if (reportedErrors.has(current)) {
			return true;
		}
		visited.add(current);
		current = current.cause;
	}
	return false;
}

/**
 * Describe an error for local logs. The telemetry boundary sanitizes this data separately.
 * @param {unknown} value
 * @returns {Record<string, unknown>}
 */
export function describeUnknownError(value) {
	if (value === undefined || value === null) {
		return {};
	}
	if (typeof value === 'string') {
		return { error_message: value };
	}
	if (typeof value === 'object') {
		const record = /** @type {Record<string, unknown>} */ (value);
		const details = {};
		for (const [source, target] of Object.entries({
			name: 'error_name',
			message: 'error_message',
			reason: 'error_reason',
			stack: 'error_stack',
			code: 'code',
			status: 'status',
		})) {
			const field = record[source];
			if (typeof field === 'string' || typeof field === 'number') {
				details[target] = field;
			}
		}
		// Traverse Error.cause explicitly: native Error properties are not enumerable.
		const seen = new WeakSet([value]);
		const causes = [];
		let cause = record.cause;
		while (cause !== null && cause !== undefined && causes.length < MAX_ERROR_CAUSES) {
			if (typeof cause !== 'object') {
				causes.push({ error_message: String(cause) });
				break;
			}
			if (seen.has(cause)) {
				break;
			}
			seen.add(cause);
			const { cause: nextCause, ...causeDetails } = cause;
			causes.push({
				...causeDetails,
				error_name: cause.name,
				error_message: cause.message,
			});
			cause = nextCause;
		}
		if (causes.length) {
			details.error_causes = causes;
		}
		// Kept only for private-value discovery at the telemetry boundary, never transmitted.
		details.error_payload = safeJsonStringify(value);
		return details;
	}
	return { error_message: String(value) };
}

/** Format a failure and its causes for selectable, local troubleshooting details. */
export function formatErrorDetails(error) {
	const details = describeUnknownError(error);
	const entries = [details, ...(details.error_causes ?? [])];
	return (
		entries
			.map((entry) =>
				[
					entry.error_name,
					entry.error_message,
					typeof (entry.error_reason ?? entry.reason) === 'string'
						? `reason: ${entry.error_reason ?? entry.reason}`
						: undefined,
					entry.code !== undefined ? `code: ${entry.code}` : undefined,
					entry.status !== undefined ? `status: ${entry.status}` : undefined,
				]
					.filter((value) => value !== undefined && value !== '')
					.join(': ')
			)
			.filter(Boolean)
			.join('\nCaused by: ') ||
		(error !== undefined && error !== null ? 'No additional error details were provided.' : '')
	);
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function safeJsonStringify(value) {
	try {
		return JSON.stringify(value);
	} catch {
		return String(value);
	}
}

/*
 * Description: Handle errors by alerting the user and logging additional information to the Chrome console
 * Param: message: String: The message to display to the user.
 * Param: moreInfo: Any: (Optional) Any additional information to log to the console.
 */
export const handleError = (
	message,
	moreInfo,
	{ silent = false, telemetryMessage = message, privateValues = [], context = {} } = {}
) => {
	const details = describeUnknownError(moreInfo);
	if (moreInfo !== undefined && moreInfo !== null) {
		console.error('[handleError]', message, moreInfo);
		if (Object.keys(details).length > 0 && !(moreInfo instanceof Error)) {
			console.error('[handleError] serialized', details);
		}
	} else {
		console.error('[handleError]', message);
	}
	if (!wasReported(moreInfo)) {
		markErrorReported(moreInfo);
		telemetry
			.trackError('app.error', telemetryMessage, {
				...getResumeContext(),
				online: typeof navigator !== 'undefined' ? navigator.onLine : undefined,
				...context,
				...details,
				private_text: privateValues,
			})
			.catch(() => {});
	}
	if (!silent) {
		alert(message);
	}
};
