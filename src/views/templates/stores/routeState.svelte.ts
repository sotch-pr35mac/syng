/**
 * Creates a reactive, module-scoped value that survives component unmounts for the
 * lifetime of the app session. Used to hoist per-route UI state out of route components
 * so that navigating away and back preserves the state. Intentionally in-memory only —
 * values reset on full reload.
 *
 * The shape mirrors `mobileCharacterWindowWordStore`: callers read
 * `.value` and write via `.set(next)`. Consuming `.value` inside a Svelte template or
 * `$derived` is reactive because it reads an underlying `$state`.
 *
 * For stores with multiple fields, define a bespoke store module instead of composing
 * several of these — it reads more clearly and keeps related state together.
 */
export function createRouteState<T>(initial: T) {
	let value = $state(initial);

	return {
		get value(): T {
			return value;
		},
		set(next: T): void {
			value = next;
		},
	};
}
