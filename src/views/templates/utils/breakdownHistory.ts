let nextOwner = 0;
/** Same-document Back steps for replacement views; companion panels need no steps. */
export function breakdownHistory(onDepth: (depth: number) => void) {
	const owner = `breakdown-${Date.now()}-${++nextOwner}`;
	const url = window.location.href;
	let depth = 0;
	let desired = 0;
	let navigating = false;
	let destroyed = false;
	const marker = () => window.history.state?.syngBreakdown;
	function reconcile() {
		// history.go is asynchronous. Finish it before applying a newer layout/depth.
		if (navigating) {
			return;
		}
		if (depth > desired && marker()?.owner === owner && window.location.href === url) {
			navigating = true;
			window.history.go(desired - depth);
			return;
		}
		while (!destroyed && depth < desired && window.location.href === url) {
			depth++;
			window.history.pushState(
				{ ...window.history.state, syngBreakdown: { owner, depth } },
				'',
				url
			);
		}
		if (destroyed) {
			window.removeEventListener('popstate', pop);
		}
	}
	function pop() {
		const state = marker();
		if (navigating) {
			navigating = false;
			depth = state?.owner === owner ? state.depth : 0;
			reconcile();
			return;
		}
		if (!depth && state?.owner !== owner) {
			return;
		}
		depth = state?.owner === owner ? state.depth : 0;
		desired = depth;
		if (!destroyed) {
			onDepth(depth);
		}
	}
	window.addEventListener('popstate', pop);
	return {
		sync(nextDepth: number) {
			desired = nextDepth;
			reconcile();
		},
		back(): boolean {
			if (!desired) {
				return false;
			}
			desired--;
			onDepth(desired);
			reconcile();
			return true;
		},
		destroy() {
			destroyed = true;
			desired = 0;
			reconcile();
		},
	};
}
