/**
 * Per-view browser history for mobile replacement views. Companion panels sync to
 * zero because they do not replace the entry. Dispose with the owning component.
 * Entries retain ancestor depths so popup Back steps preserve a covered study view.
 */
type BreakdownHistoryMarker = {
	owner: string;
	depth: number;
	ancestors?: Record<string, number>;
};
let nextOwner = 0;
/** Create a controller; onDepth handles user Back/Forward, not layout reconciliation. */
export function breakdownHistory(onDepth: (depth: number) => void) {
	const owner = `breakdown-${Date.now()}-${++nextOwner}`;
	const url = window.location.href;
	let depth = 0;
	let desired = 0;
	let navigating = false;
	let destroyed = false;
	const marker = (): BreakdownHistoryMarker | undefined => window.history.state?.syngBreakdown;
	const depthAt = (state: BreakdownHistoryMarker | undefined) =>
		window.location.href !== url
			? 0
			: state?.owner === owner
				? state.depth
				: (state?.ancestors?.[owner] ?? 0);
	/** Serialize asynchronous traversals before responding to another resize or Back. */
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
			const current = marker();
			const ancestors = { ...current?.ancestors };
			if (current && current.owner !== owner) {
				ancestors[current.owner] = current.depth;
			}
			delete ancestors[owner];
			depth++;
			window.history.pushState(
				{ ...window.history.state, syngBreakdown: { owner, depth, ancestors } },
				'',
				url
			);
		}
		if (destroyed) {
			window.removeEventListener('popstate', pop);
		}
	}
	/** Interpret each destination for this owner, including entries belonging to overlays. */
	function pop() {
		const state = marker();
		if (navigating) {
			navigating = false;
			depth = depthAt(state);
			reconcile();
			return;
		}
		const nextDepth = depthAt(state);
		if (depth === nextDepth) {
			return;
		}
		depth = nextDepth;
		desired = depth;
		if (!destroyed) {
			onDepth(depth);
		}
	}
	window.addEventListener('popstate', pop);
	return {
		/** Mirror the rendered stack depth; zero also removes companion-mode Back steps. */
		sync(nextDepth: number) {
			desired = nextDepth;
			reconcile();
		},
		/** Pop a local step immediately; false lets the caller handle its route/root Back. */
		back(): boolean {
			if (!desired) {
				return false;
			}
			desired--;
			onDepth(desired);
			reconcile();
			return true;
		},
		/** Remove owned steps, then release the listener once pending traversal finishes. */
		destroy() {
			destroyed = true;
			desired = 0;
			reconcile();
		},
	};
}
