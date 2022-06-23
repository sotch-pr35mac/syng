/*
 * Description: Handle errors by alerting the user and logging additional information to the Chrome console
 * Param: message: String: The message to display to the user.
 * Param: moreInfo: Any: (Optional) Any additional information to log to the console.
 */
export const handleError = (message, moreInfo) => {
	if (moreInfo) {
		console.error(moreInfo);
	}
	alert(message);
};
