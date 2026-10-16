import { afterEach, describe, expect, it, vi } from 'vitest';
import { responsiveLayout } from '@/actions/responsiveLayout.js';

const mocks = vi.hoisted(() => ({
	listener: undefined as (() => void) | undefined,
	unsubscribe: vi.fn(),
}));
vi.mock('@/composables/systemTypography.js', () => ({
	subscribeSystemTypography: (listener: () => void) => {
		mocks.listener = listener;
		return mocks.unsubscribe;
	},
}));
afterEach(() => {
	document.documentElement.style.removeProperty('font-size');
	vi.restoreAllMocks();
});

describe('available-width layout switching', () => {
	it('responds to system text changes even when the container width stays fixed', () => {
		const element = document.createElement('div');
		vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({ width: 800 } as DOMRect);
		document.documentElement.style.fontSize = '16px';
		const action = responsiveLayout(element, { thresholdRem: 44, className: 'stacked' });
		expect(element.classList.contains('stacked')).toBe(false);
		document.documentElement.style.fontSize = '32px';
		mocks.listener?.();
		expect(element.classList.contains('stacked')).toBe(true);
		action.destroy();
		expect(mocks.unsubscribe).toHaveBeenCalled();
	});
});
