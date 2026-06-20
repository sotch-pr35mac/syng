import { telemetry } from '@/utils/telemetry.js';

/**
 * Diagnostics for the resume-time database failure: after the mobile app is
 * backgrounded and resumed, bookmark/list reads can fail (the leading hypothesis is
 * stale IndexedDB handles). This module records foreground/background breadcrumbs and
 * exposes a resume context that error reports attach, so we can confirm whether those
 * failures follow a recent resume — before changing the database layer. No behavior
 * change; telemetry only. See utils/bookmarkManager.js for where the context is used.
 */

// When the app last came to the foreground (or first loaded).
let lastForegroundAt = Date.now();

/**
 * Snapshot attached to database error reports so they can be correlated with a recent
 * resume from suspension.
 */
export function getResumeContext(): { visibility_state: string; ms_since_foreground: number } {
	return {
		visibility_state: typeof document !== 'undefined' ? document.visibilityState : 'unknown',
		ms_since_foreground: Date.now() - lastForegroundAt,
	};
}

/**
 * Registers foreground/background breadcrumbs. Returns a cleanup function that removes
 * the listeners.
 */
export function startLifecycleDiagnostics(): () => void {
	const handleVisibilityChange = () => {
		const visible = document.visibilityState === 'visible';
		if (visible) {
			lastForegroundAt = Date.now();
		}
		telemetry
			.trackEvent('app.lifecycle', { state: visible ? 'foreground' : 'background' })
			.catch(() => {});
	};
	const handlePageShow = () => {
		lastForegroundAt = Date.now();
		telemetry.trackEvent('app.lifecycle', { state: 'pageshow' }).catch(() => {});
	};

	document.addEventListener('visibilitychange', handleVisibilityChange);
	window.addEventListener('pageshow', handlePageShow);

	return () => {
		document.removeEventListener('visibilitychange', handleVisibilityChange);
		window.removeEventListener('pageshow', handlePageShow);
	};
}
