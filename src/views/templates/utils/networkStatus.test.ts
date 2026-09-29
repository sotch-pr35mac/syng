import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }));

import {
	initializeNetworkStatus,
	networkStatus,
	resetNetworkStatusForTest,
} from '@/utils/networkStatus.svelte.js';

function setNavigatorOnline(online: boolean): void {
	Object.defineProperty(window.navigator, 'onLine', {
		configurable: true,
		value: online,
	});
}

beforeEach(() => {
	resetNetworkStatusForTest();
	mocks.invoke.mockReset();
	mocks.invoke.mockResolvedValue(undefined);
	setNavigatorOnline(true);
});

afterEach(() => {
	resetNetworkStatusForTest();
});

it('initializes from navigator status and silently synchronizes native code', () => {
	setNavigatorOnline(false);
	initializeNetworkStatus();

	expect(networkStatus.isOffline).toBe(true);
	expect(mocks.invoke).toHaveBeenCalledWith('set_network_online', { online: false });
});

it('updates reactive status and native synchronization on browser transitions', () => {
	initializeNetworkStatus();
	setNavigatorOnline(false);
	window.dispatchEvent(new Event('offline'));
	expect(networkStatus.isOffline).toBe(true);

	setNavigatorOnline(true);
	window.dispatchEvent(new Event('online'));
	expect(networkStatus.isOnline).toBe(true);
	expect(mocks.invoke).toHaveBeenLastCalledWith('set_network_online', { online: true });
});

it('does not surface native bridge failures', async () => {
	mocks.invoke.mockRejectedValue(new Error('bridge unavailable'));
	expect(() => initializeNetworkStatus()).not.toThrow();
	await Promise.resolve();
	expect(networkStatus.isOnline).toBe(true);
});
