import { mobileBreakdown } from '@/stores/mobileBreakdown.js';

let suspended: { origin: string; end: () => void } | undefined;

/** A routed breakdown is part of the current study session, not a new session.
 * Keep the composable's card/question and telemetry counters alive while its view
 * unmounts. Only an exact return (including list parameters) resumes that session.
 */
export function enterStudySession(start: () => void): void {
	const previous = suspended;
	suspended = undefined;
	if (previous?.origin === window.location.hash) {
		return;
	}
	previous?.end();
	start();
}

export function leaveStudySession(end: () => void): void {
	const origin = mobileBreakdown.origin;
	if (
		window.location.hash === '#/breakdown' &&
		origin &&
		/^#\/study\/(flashcards|quiz)(\?|$)/.test(origin)
	) {
		suspended = { origin, end };
	} else {
		end();
	}
}

/** Leaving breakdown for somewhere other than its study answer ends the session. */
export function finishStudyBreakdown(): void {
	if (suspended && window.location.hash !== suspended.origin) {
		const previous = suspended;
		suspended = undefined;
		previous.end();
	}
}
