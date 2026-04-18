import { render } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import SyTab from './SyTab.svelte';

it('should not have the active class by default', () => {
	const { getByRole } = render(SyTab);

	expect(getByRole('button').className).not.toContain('sy-tab--active');
});

it('should apply the active class when active is true', () => {
	const { getByRole } = render(SyTab, { active: true });

	expect(getByRole('button').className).toContain('sy-tab--active');
});

it('should call onclick when clicked', async () => {
	const user = userEvent.setup();
	const handleClick = vi.fn();
	const { getByRole } = render(SyTab, { onclick: handleClick });

	await user.click(getByRole('button'));

	expect(handleClick).toHaveBeenCalledOnce();
});
