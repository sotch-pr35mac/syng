import { render } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import SyToggle from '@/components/SyToggle/SyToggle.svelte';

it('exposes a named checkbox that can be reached and changed with the keyboard', async () => {
	const user = userEvent.setup();
	const onchange = vi.fn();
	const { getByRole } = render(SyToggle, {
		value: 'tone-color',
		accessibleLabel: 'Color pinyin by tone',
		onchange,
	});
	const checkbox = getByRole('checkbox', { name: 'Color pinyin by tone' }) as HTMLInputElement;

	await user.tab();
	expect(document.activeElement).toBe(checkbox);
	await user.keyboard(' ');
	expect(checkbox.checked).toBe(true);
	expect(onchange).toHaveBeenCalledExactlyOnceWith(true);
});

it('supports a native accessible label and descriptive relationship', () => {
	const { getByRole } = render(SyToggle, {
		value: 'tone-color',
		accessibleLabel: 'Legacy label',
		'aria-label': 'Pronunciation colors',
		'aria-describedby': 'pronunciation-help',
	});
	const checkbox = getByRole('checkbox', { name: 'Pronunciation colors' });

	expect(checkbox.getAttribute('aria-describedby')).toBe('pronunciation-help');
});

it('keeps the visible switch label associated with the checkbox', async () => {
	const user = userEvent.setup();
	const onchange = vi.fn();
	const { container, getByRole } = render(SyToggle, {
		id: 'pinyin-toggle',
		value: 'pinyin',
		accessibleLabel: 'Show pinyin',
		onchange,
	});
	const label = container.querySelector('label') as HTMLLabelElement;
	const checkbox = getByRole('checkbox', { name: 'Show pinyin' }) as HTMLInputElement;

	expect(label.control).toBe(checkbox);
	await user.click(label);
	expect(checkbox.checked).toBe(true);
	expect(onchange).toHaveBeenCalledExactlyOnceWith(true);
});

it('does not tab to or activate a disabled checkbox through its label', async () => {
	const user = userEvent.setup();
	const onchange = vi.fn();
	const { container, getByRole } = render(SyToggle, {
		value: 'pinyin',
		accessibleLabel: 'Show pinyin',
		disabled: true,
		onchange,
	});
	const checkbox = getByRole('checkbox', { name: 'Show pinyin' });

	await user.tab();
	expect(document.activeElement).not.toBe(checkbox);
	await user.click(container.querySelector('label') as HTMLLabelElement);
	expect(onchange).not.toHaveBeenCalled();
});
