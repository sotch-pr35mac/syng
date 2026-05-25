const READER_DOCUMENT_ROUTE_PATTERN = /^\/read\/document\/.+/;

/**
 * Maps a hash-router location to a telemetry screen name. Document IDs
 * are stripped from dynamic routes so telemetry does not record which
 * specific document the user is viewing.
 */
export function getRouteScreenName(
	location: string,
	screenNames: Record<string, string>
): string | undefined {
	if (READER_DOCUMENT_ROUTE_PATTERN.test(location)) {
		return 'reader-document';
	}
	return screenNames[location];
}
