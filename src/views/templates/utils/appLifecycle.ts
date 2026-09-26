import { telemetry } from '@/utils/telemetry.js';

/**
 * App lifecycle telemetry: records foreground/background/pageshow breadcrumbs as the
 * app is suspended and resumed (emitted as `app.lifecycle` events). It also
 * exposes a resume context (`getResumeContext`) that error reports attach so failures can
 * be correlated with a recent resume from suspension. Used by desktop and mobile
 * shells, the shared error handler, and bookmark diagnostics. Telemetry only.
 */

// When the app last came to the foreground (or first loaded).
let lastForegroundAt = Date.now();

/**
 * Snapshot attached to error reports so they can be correlated with a recent
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
