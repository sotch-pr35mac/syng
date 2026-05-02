import { telemetry } from '@/utils/telemetry.js';

/**
 * Turn an unknown rejection / thrown value into a plain object safe for telemetry and logs.
 * @param {unknown} value
 * @returns {Record<string, string>}
 */
export function describeUnknownError(value) {
	if (value === undefined || value === null) {
		return {};
	}
	if (value instanceof Error) {
		return {
			error_name: value.name,
			error_message: value.message,
			error_stack: value.stack ?? '',
		};
	}
	if (typeof value === 'string') {
		return { error_message: value };
	}
	if (typeof value === 'object') {
		const record = /** @type {Record<string, unknown>} */ (value);
		const message = record.message;
		if (typeof message === 'string') {
			return {
				error_message: message,
				error_payload: safeJsonStringify(value),
			};
		}
		return { error_payload: safeJsonStringify(value) };
	}
	return { error_detail: String(value) };
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
export const handleError = (message, moreInfo, { silent = false } = {}) => {
	const details = describeUnknownError(moreInfo);
	if (moreInfo !== undefined && moreInfo !== null) {
		console.error('[handleError]', message, moreInfo);
		if (Object.keys(details).length > 0 && !(moreInfo instanceof Error)) {
			console.error('[handleError] serialized', details);
		}
	} else {
		console.error('[handleError]', message);
	}
	telemetry.trackError('app.error', message, details).catch(() => {});
	if (!silent) {
		alert(message);
	}
};
