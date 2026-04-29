import { afterEach, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import MobileTimer from '@/components/MobileTimer/MobileTimer.svelte';

vi.mock('lucide-svelte', async () => {
	const mockIcon = (await import('@/components/__mocks__/FeatherIcon.svelte')).default;
	return {
		Pause: mockIcon,
		Play: mockIcon,
	};
});

afterEach(() => {
	vi.useRealTimers();
});

it('pauses and resumes without completing while paused', async () => {
	const PAUSED_TIME_MS = 1500;
	const RESUMED_COMPLETION_TIME_MS = 1100;
	vi.useFakeTimers();
	const oncomplete = vi.fn();
	render(MobileTimer, { duration: 1, autoStart: true, oncomplete });

	const timer = screen.getByRole('button', { name: 'Pause timer' });
	await fireEvent.click(timer);
	expect(screen.getByRole('button', { name: 'Resume timer' })).toBeTruthy();

	await vi.advanceTimersByTimeAsync(PAUSED_TIME_MS);
	expect(oncomplete).not.toHaveBeenCalled();

	await fireEvent.click(timer);
	expect(screen.getByRole('button', { name: 'Pause timer' })).toBeTruthy();

	await vi.advanceTimersByTimeAsync(RESUMED_COMPLETION_TIME_MS);
	expect(oncomplete).toHaveBeenCalledTimes(1);
});
