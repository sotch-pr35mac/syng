import { afterEach, expect, it, vi } from 'vitest';
import { mobileBreakdown } from '@/stores/mobileBreakdown.js';
import {
	enterStudySession,
	leaveStudySession,
	finishStudyBreakdown,
} from '@/composables/studyBreakdownSession.js';

afterEach(() => {
	window.location.hash = '#/';
	finishStudyBreakdown();
	mobileBreakdown.origin = undefined;
});

it.each(['flashcards', 'quiz'])('preserves the %s session for an exact return', (mode) => {
	const start = vi.fn(),
		end = vi.fn();
	const origin = `#/study/${mode}?list=Review&from=bookmarks`;
	window.location.hash = origin;
	enterStudySession(start);
	mobileBreakdown.origin = origin;
	window.location.hash = '#/breakdown';
	leaveStudySession(end);
	expect(end).not.toHaveBeenCalled();
	window.location.hash = origin;
	finishStudyBreakdown();
	enterStudySession(start);
	expect(start).toHaveBeenCalledTimes(1);
	expect(end).not.toHaveBeenCalled();
	window.location.hash = '#/bookmarks';
	leaveStudySession(end);
	expect(end).toHaveBeenCalledTimes(1);
});

it.each(['#/bookmarks', '#/study/quiz?list=Other'])(
	'ends the session when breakdown exits to %s',
	(destination) => {
		const end = vi.fn();
		mobileBreakdown.origin = '#/study/quiz?list=Review';
		window.location.hash = '#/breakdown';
		leaveStudySession(end);
		window.location.hash = destination;
		finishStudyBreakdown();
		finishStudyBreakdown();
		expect(end).toHaveBeenCalledTimes(1);
		const start = vi.fn();
		enterStudySession(start);
		expect(start).toHaveBeenCalledTimes(1);
	}
);
