import { invoke } from '@tauri-apps/api/core';
import { NATIVE_COMMANDS } from '@/types/nativeCommands.js';

let online = $state(true);
let initialized = false;

function readNavigatorOnline(): boolean {
	return typeof navigator === 'undefined' || navigator.onLine !== false;
}

function synchronizeNativeStatus(): void {
	const command = NATIVE_COMMANDS.APP?.SET_NETWORK_ONLINE;
	if (!command) {
		return;
	}
	invoke(command, { online }).catch(() => {});
}

function updateStatus(): void {
	online = readNavigatorOnline();
	synchronizeNativeStatus();
}

/**
 * Shared, reactive browser connectivity status. `true` permits remote work but does not prove a
 * Syng endpoint is reachable; only `false` is treated as definitively offline.
 */
export const networkStatus = {
	get isOnline(): boolean {
		return online;
	},
	get isOffline(): boolean {
		return !online;
	},
};

export function isOnline(): boolean {
	return networkStatus.isOnline;
}

export function isOffline(): boolean {
	return networkStatus.isOffline;
}

/** Starts one browser-status listener pair and synchronizes the initial status with native code. */
export function initializeNetworkStatus(): void {
	if (initialized || typeof window === 'undefined') {
		return;
	}
	initialized = true;
	updateStatus();
	window.addEventListener('online', updateStatus);
	window.addEventListener('offline', updateStatus);
}

/** Test-only reset that also removes listeners from the active window. */
export function resetNetworkStatusForTest(): void {
	if (initialized && typeof window !== 'undefined') {
		window.removeEventListener('online', updateStatus);
		window.removeEventListener('offline', updateStatus);
	}
	initialized = false;
	online = true;
}
