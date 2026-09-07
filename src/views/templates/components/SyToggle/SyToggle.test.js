import { render } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import SyToggle from '@/components/SyToggle/SyToggle.svelte';

it('should have the uuid passed to it', async () => {
	const { getByRole } = render(SyToggle, {
		id: 'test-id',
		value: 'test',
	});
	const id = getByRole('checkbox', { hidden: true }).id;

	expect(id).toBe('test-id');
});

it('uses the provided accessible label', () => {
	const { getByLabelText } = render(SyToggle, {
		value: 'test',
		accessibleLabel: 'Color pinyin by tone',
	});

	expect(getByLabelText('Color pinyin by tone')).toBeTruthy();
});

it('should respect the state passed to it', async () => {
	const { getByRole } = render(SyToggle, {
		value: 'test',
		checked: true,
	});
	const state = getByRole('checkbox', { hidden: true }).checked;

	expect(state).toBe(true);
});

it('should update its state once clicked', async () => {
	const user = userEvent.setup();
	const { getByRole } = render(SyToggle, {
		value: 'test',
	});
	const element = getByRole('checkbox', { hidden: true });

	let state = element.checked;
	expect(state).toBe(false);

	await user.click(element);
	state = element.checked;
	expect(state).toBe(true);
});

it('does not change state when disabled', async () => {
	const user = userEvent.setup();
	const onchange = vi.fn();
	const { getByRole } = render(SyToggle, {
		value: 'test',
		disabled: true,
		onchange,
	});
	const element = getByRole('checkbox', { hidden: true });

	expect(element.disabled).toBe(true);
	await user.click(element);
	expect(element.checked).toBe(false);
	expect(onchange).not.toHaveBeenCalled();
});
