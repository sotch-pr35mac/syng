import { fireEvent, render } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import ReaderColorSwatches from '@/components/Reader/ReaderColorSwatches.svelte';

it('names preset colors and exposes their selected state without relying on their appearance', async () => {
	const user = userEvent.setup();
	const onchange = vi.fn();
	const { getByRole, rerender } = render(ReaderColorSwatches, { value: '#ffffff', onchange });
	expect(getByRole('group', { name: 'Document color' })).toBeTruthy();
	expect(getByRole('button', { name: 'Use White document color', pressed: true })).toBeTruthy();
	await user.click(getByRole('button', { name: 'Use Blue document color' }));
	expect(onchange).toHaveBeenCalledWith('#76aff9');
	await rerender({ value: '#76aff9' });
	expect(getByRole('button', { name: 'Use Blue document color', pressed: true })).toBeTruthy();
});

it('keeps the native custom color input named and in the keyboard order', async () => {
	const user = userEvent.setup();
	const onchange = vi.fn();
	const { getByLabelText, getByRole } = render(ReaderColorSwatches, { onchange });
	const customColor = getByLabelText('Custom document color');
	expect(customColor.tagName).toBe('INPUT');
	expect(customColor.closest('button')).toBeNull();
	expect(customColor.hasAttribute('aria-hidden')).toBe(false);
	getByRole('button', { name: 'Use Lavender document color' }).focus();
	await user.tab();
	expect(document.activeElement).toBe(customColor);
	await fireEvent.input(customColor, { target: { value: '#123456' } });
	expect(onchange).toHaveBeenCalledWith('#123456');
});
