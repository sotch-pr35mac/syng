import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import SyTimer from '@/components/SyTimer/SyTimer.svelte';
import MobileTimer from '@/components/MobileTimer/MobileTimer.svelte';

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(0);
});
afterEach(() => {
	vi.useRealTimers();
});

for (const [name, component] of [
	['desktop', SyTimer],
	['mobile', MobileTimer],
] as const) {
	describe(`${name} instruction suspension`, () => {
		it('does not expire during instructions and preserves remaining time', async () => {
			const oncomplete = vi.fn();
			const view = render(component, { duration: 2, autoStart: true, oncomplete });
			await vi.advanceTimersByTimeAsync(500);
			await view.rerender({ suspended: true });
			await vi.advanceTimersByTimeAsync(10000);
			expect(oncomplete).not.toHaveBeenCalled();
			await view.rerender({ suspended: false });
			await vi.advanceTimersByTimeAsync(1000);
			expect(oncomplete).not.toHaveBeenCalled();
			await vi.advanceTimersByTimeAsync(600);
			expect(oncomplete).toHaveBeenCalledTimes(1);
		});
		it('supports starting suspended and preserves a separate manual pause', async () => {
			const oncomplete = vi.fn();
			const view = render(component, {
				duration: 1,
				autoStart: true,
				suspended: true,
				oncomplete,
			});
			await vi.advanceTimersByTimeAsync(5000);
			view.component.pause();
			await view.rerender({ suspended: false });
			await vi.advanceTimersByTimeAsync(5000);
			expect(oncomplete).not.toHaveBeenCalled();
			view.component.resume();
			await vi.advanceTimersByTimeAsync(1100);
			expect(oncomplete).toHaveBeenCalledTimes(1);
		});
	});
}
