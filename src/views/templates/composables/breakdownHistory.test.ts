import { afterEach, expect, it, vi } from 'vitest';
import { breakdownHistory } from '@/composables/breakdownHistory.js';

afterEach(() => vi.restoreAllMocks());

it('preserves a covered study view through popup Back and Forward, then closes it on its own Back', () => {
	let state: unknown = null;
	vi.spyOn(window.history, 'state', 'get').mockImplementation(() => state);
	vi.spyOn(window.history, 'pushState').mockImplementation((next) => {
		state = next;
	});
	vi.spyOn(window.history, 'go').mockImplementation(() => {});
	const onStudyDepth = vi.fn();
	const onPopupDepth = vi.fn();
	const study = breakdownHistory(onStudyDepth);
	study.sync(1);
	const studyEntry = state;
	const popup = breakdownHistory(onPopupDepth);
	popup.sync(1);
	const popupBreakdown = state;
	popup.sync(2);
	const popupLookup = state;
	const traverse = (destination: unknown) => {
		state = destination;
		window.dispatchEvent(new PopStateEvent('popstate'));
	};
	traverse(popupBreakdown);
	expect(onPopupDepth).toHaveBeenLastCalledWith(1);
	expect(onStudyDepth).not.toHaveBeenCalled();
	traverse(popupLookup);
	expect(onPopupDepth).toHaveBeenLastCalledWith(2);
	expect(onStudyDepth).not.toHaveBeenCalled();
	traverse(studyEntry);
	expect(onPopupDepth).toHaveBeenLastCalledWith(0);
	expect(onStudyDepth).not.toHaveBeenCalled();
	popup.destroy();
	traverse(null);
	expect(onStudyDepth).toHaveBeenCalledExactlyOnceWith(0);
	study.destroy();
});

it('serializes a rapid narrow/wide/narrow round trip without closing the panel', () => {
	let state: unknown = null;
	vi.spyOn(window.history, 'state', 'get').mockImplementation(() => state);
	vi.spyOn(window.history, 'pushState').mockImplementation((next) => {
		state = next;
	});
	const go = vi.spyOn(window.history, 'go').mockImplementation(() => {});
	const onDepth = vi.fn();
	const history = breakdownHistory(onDepth);
	history.sync(1);
	history.sync(0);
	expect(go).toHaveBeenCalledExactlyOnceWith(-1);
	history.sync(1); // Resize back before the previous history traversal completes.
	state = null;
	window.dispatchEvent(new PopStateEvent('popstate'));
	expect(state).toMatchObject({ syngBreakdown: { depth: 1 } });
	expect(onDepth).not.toHaveBeenCalled();
	state = null; // A subsequent system Back should now close the replacement view.
	window.dispatchEvent(new PopStateEvent('popstate'));
	expect(onDepth).toHaveBeenCalledExactlyOnceWith(0);
	history.destroy();
});
