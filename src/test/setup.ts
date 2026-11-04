/**
 * Browser APIs missing from jsdom. Svelte dimension bindings require an observer
 * even in tests that only assert content/navigation. jsdom has no layout engine,
 * so this stub deliberately emits no measurements; Playwright covers real sizing.
 * Install as the environment baseline so per-test vi.stubGlobal overrides can
 * restore it with vi.unstubAllGlobals.
 */
globalThis.ResizeObserver = class implements ResizeObserver {
	observe(): void {}
	unobserve(): void {}
	disconnect(): void {}
};
