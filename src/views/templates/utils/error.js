import { telemetry } from '@/utils/telemetry.js';

/*
 * Description: Handle errors by alerting the user and logging additional information to the Chrome console
 * Param: message: String: The message to display to the user.
 * Param: moreInfo: Any: (Optional) Any additional information to log to the console.
 */
export const handleError = (message, moreInfo, { silent = false } = {}) => {
	if (moreInfo) {
		console.error(moreInfo);
	}
	telemetry.trackError('app.error', message, {}).catch(() => {});
	if (!silent) {
		alert(message);
	}
};
