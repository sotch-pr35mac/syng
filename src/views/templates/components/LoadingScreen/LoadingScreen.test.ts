import { expect, it, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import LoadingScreen from '@/components/LoadingScreen/LoadingScreen.svelte';

it('renders caller-provided loading copy in an accessible status', () => {
	const { getByRole, getByText } = render(LoadingScreen, {
		title: 'Starting Syng…',
		detail: 'Loading your preferences.',
		messages: [],
	});

	expect(getByRole('status').textContent).toContain('Starting Syng…');
	expect(getByText('Loading your preferences.')).toBeTruthy();
});

it('renders a configurable error and action', async () => {
	const onaction = vi.fn();
	const user = userEvent.setup();
	const { getByRole } = render(LoadingScreen, {
		status: 'error',
		title: 'Syng couldn’t start.',
		detail: 'Please restart the app.',
		actionLabel: 'Try again',
		onaction,
		messages: [],
	});

	expect(getByRole('alert').textContent).toContain('Please restart the app.');
	await user.click(getByRole('button', { name: 'Try again' }));
	expect(onaction).toHaveBeenCalledOnce();
});
