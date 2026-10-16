import { beforeEach, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { listen, type EventCallback } from '@tauri-apps/api/event';
import type { SystemTypographySnapshot } from '@/types/accessibility.js';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn() }));

let typography: typeof import('@/composables/systemTypography.js');
let receiveEvent: EventCallback<SystemTypographySnapshot>;
let dispose: (() => void) | undefined;
const unlisten = vi.fn();

beforeEach(async () => {
	dispose?.();
	dispose = undefined;
	vi.resetModules();
	vi.mocked(invoke).mockReset();
	vi.mocked(listen).mockReset();
	unlisten.mockClear();
	document.documentElement.removeAttribute('style');
	vi.mocked(listen).mockImplementation(async (_event, callback) => {
		receiveEvent = callback as EventCallback<SystemTypographySnapshot>;
		return unlisten;
	});
	vi.mocked(invoke).mockResolvedValue({ rootFontSizePx: 16, revision: 0 });
	typography = await import('@/composables/systemTypography.js');
});

function emit(snapshot: SystemTypographySnapshot): void {
	receiveEvent({ event: 'system-typography-changed', id: 1, payload: snapshot });
}

it('subscribes before loading the initial size and updates application typography', async () => {
	vi.mocked(invoke).mockResolvedValue({ rootFontSizePx: 24, revision: 1 });
	dispose = await typography.initializeSystemTypography();

	expect(vi.mocked(listen).mock.invocationCallOrder[0]).toBeLessThan(
		vi.mocked(invoke).mock.invocationCallOrder[0]
	);
	expect(document.documentElement.style.getPropertyValue('--sy-system-font-size')).toBe('24px');
	expect(document.documentElement.style.getPropertyValue('--sy-system-text-scale')).toBe('1.5');
});

it('retains a newer event when the initial snapshot finishes later', async () => {
	let resolveSnapshot: (_value: SystemTypographySnapshot) => void = () => {};
	vi.mocked(invoke).mockImplementation(
		() =>
			new Promise((resolve) => {
				resolveSnapshot = resolve;
			})
	);
	const initializing = typography.initializeSystemTypography();
	await vi.waitFor(() => expect(invoke).toHaveBeenCalled());
	emit({ rootFontSizePx: 32, revision: 2 });
	resolveSnapshot({ rootFontSizePx: 24, revision: 1 });
	dispose = await initializing;

	expect(typography.getSystemTypographySnapshot()).toEqual({ rootFontSizePx: 32, revision: 2 });
});

it('notifies layout subscribers only when the accepted size changes', async () => {
	const subscriber = vi.fn();
	const unsubscribe = typography.subscribeSystemTypography(subscriber);
	dispose = await typography.initializeSystemTypography();
	emit({ rootFontSizePx: 32, revision: 1 });
	emit({ rootFontSizePx: 32, revision: 2 });
	emit({ rootFontSizePx: 16, revision: 3 });

	expect(subscriber.mock.calls.map(([snapshot]) => snapshot.rootFontSizePx)).toEqual([
		16, 32, 16,
	]);
	unsubscribe();
	emit({ rootFontSizePx: 24, revision: 4 });
	expect(subscriber).toHaveBeenCalledTimes(3);
});

it('ignores malformed data and preserves accessibility sizes above 200 percent', async () => {
	dispose = await typography.initializeSystemTypography();
	emit({ rootFontSizePx: 56, revision: 1 });
	for (const invalidSize of [Number.NaN, Number.POSITIVE_INFINITY, 0, -1]) {
		emit({ rootFontSizePx: invalidSize, revision: 2 });
	}
	emit({ rootFontSizePx: 16, revision: -1 });
	expect(typography.getSystemTypographySnapshot()).toEqual({ rootFontSizePx: 56, revision: 1 });
});

it('falls back without preventing startup when native APIs are unavailable', async () => {
	vi.mocked(listen).mockRejectedValue(new Error('not in a webview'));
	vi.mocked(invoke).mockRejectedValue(new Error('not in a webview'));
	dispose = await typography.initializeSystemTypography();
	expect(typography.getSystemTypographySnapshot()).toEqual({ rootFontSizePx: 16, revision: 0 });
});

it('shares initialization and stops native and lifecycle updates after cleanup', async () => {
	const firstInitialization = typography.initializeSystemTypography();
	expect(typography.initializeSystemTypography()).toBe(firstInitialization);
	dispose = await firstInitialization;
	dispose();
	dispose();
	emit({ rootFontSizePx: 32, revision: 1 });
	window.dispatchEvent(new Event('pageshow'));
	expect(unlisten).toHaveBeenCalledTimes(1);
	expect(invoke).toHaveBeenCalledTimes(1);
	expect(typography.getSystemTypographySnapshot().rootFontSizePx).toBe(16);
});
