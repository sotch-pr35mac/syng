import { afterEach, expect, it, vi } from 'vitest';
import { breakdownHistory } from '@/utils/breakdownHistory.js';

afterEach(() => vi.restoreAllMocks());

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
