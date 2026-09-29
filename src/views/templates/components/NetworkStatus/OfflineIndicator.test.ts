import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import OfflineIndicator from '@/components/NetworkStatus/OfflineIndicator.svelte';
import {
	initializeNetworkStatus,
	resetNetworkStatusForTest,
} from '@/utils/networkStatus.svelte.js';

const mocks = vi.hoisted(() => ({
	isMobile: vi.fn(),
	isIPad: vi.fn(),
	invoke: vi.fn(),
}));

vi.mock('@/utils/device.js', () => ({
	isMobile: mocks.isMobile,
	isIPad: mocks.isIPad,
}));

vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }));

function setNavigatorOnline(online: boolean): void {
	Object.defineProperty(window.navigator, 'onLine', {
		configurable: true,
		value: online,
	});
}

beforeEach(() => {
	resetNetworkStatusForTest();
	mocks.isMobile.mockReturnValue(false);
	mocks.isIPad.mockReturnValue(false);
	mocks.invoke.mockResolvedValue(undefined);
	setNavigatorOnline(false);
	initializeNetworkStatus();
});

afterEach(() => {
	resetNetworkStatusForTest();
	setNavigatorOnline(true);
});

it('uses the shared top tooltip with the requested offline text', () => {
	const { getByRole, getByText } = render(OfflineIndicator);
	const indicator = getByRole('status');
	const tooltip = getByText('You are Offline');

	expect(indicator.classList.contains('sy-tooltip--container')).toBe(true);
	expect(indicator.getAttribute('aria-label')).toBe('You are Offline');
	expect(tooltip.tagName).toBe('P');
	expect(tooltip.closest('.sy-tooltip--body-top')).toBeTruthy();
});
