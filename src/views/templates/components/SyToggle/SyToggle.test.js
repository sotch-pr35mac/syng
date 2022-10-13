/* eslint-disable no-undef */
import SyToggle from './SyToggle.svelte';
import { render } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';

it('should have the uuid passed to it', async () => {
	const { getByRole } = render(SyToggle, {
		id: 'test-id',
		value: 'test'
	});
	const id = getByRole('checkbox', { hidden: true }).id;

	expect(id).toBe('test-id');
});

it('should respect the state passed to it', async () => {
	const { getByRole } = render(SyToggle, {
		value: 'test',
		checked: true
	});
	const state = getByRole('checkbox', { hidden: true }).checked;

	expect(state).toBe(true);
});

it('should update its state once clicked', async () => {
	const user = userEvent.setup();
	const { getByRole } = render(SyToggle, {
		value: 'test'
	});
	const element = getByRole('checkbox', { hidden: true });

	let state = element.checked;
	expect(state).toBe(false);

	await user.click(element);
	state = element.checked;
	expect(state).toBe(true);
});
