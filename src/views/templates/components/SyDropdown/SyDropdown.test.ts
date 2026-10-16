import { render, fireEvent } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import DropdownHarness from '@/components/SyDropdown/DropdownHarness.test.svelte';

vi.mock('@tauri-apps/plugin-os', () => ({ platform: () => 'unknown' }));

it('uses one native trigger and opens only from activation keys', async () => {
	const user = userEvent.setup();
	const { getByRole, queryByRole } = render(DropdownHarness);
	const trigger = getByRole('button', { name: 'Options' });
	expect(trigger.tagName).toBe('BUTTON');
	expect(trigger.parentElement?.getAttribute('role')).toBeNull();
	trigger.focus();
	await user.keyboard('x{ArrowRight}');
	expect(queryByRole('menu')).toBeNull();
	await user.keyboard('{ArrowDown}');
	expect(trigger.getAttribute('aria-expanded')).toBe('true');
	expect(getByRole('menu').getAttribute('aria-labelledby')).toBe(trigger.id);
	expect(document.activeElement).toBe(getByRole('menuitem', { name: 'Alpha' }));
});

it('skips disabled items and separators with arrows, Home, End and typeahead', async () => {
	const user = userEvent.setup();
	const { getByRole } = render(DropdownHarness);
	getByRole('button', { name: 'Options' }).focus();
	await user.keyboard('{ArrowUp}');
	expect(document.activeElement).toBe(getByRole('menuitem', { name: 'Bravo' }));
	await user.keyboard('{Home}{ArrowDown}');
	expect(document.activeElement).toBe(getByRole('menuitem', { name: 'Beta' }));
	await user.keyboard('{End}{ArrowDown}');
	expect(document.activeElement).toBe(getByRole('menuitem', { name: 'Alpha' }));
	await user.keyboard('b');
	expect(document.activeElement).toBe(getByRole('menuitem', { name: 'Beta' }));
	await user.keyboard('b');
	expect(document.activeElement).toBe(getByRole('menuitem', { name: 'Bravo' }));
});

it.each(['{Enter}', ' '])('selects exactly once with %s and restores focus', async (key) => {
	const user = userEvent.setup();
	const onselection = vi.fn();
	const { getByRole, queryByRole } = render(DropdownHarness, { onselection });
	const trigger = getByRole('button', { name: 'Options' });
	trigger.focus();
	await user.keyboard('{ArrowDown}');
	await user.keyboard(key);
	expect(onselection).toHaveBeenCalledExactlyOnceWith('alpha');
	expect(queryByRole('menu')).toBeNull();
	expect(document.activeElement).toBe(trigger);
});

it('dismisses Escape without selection and preserves pointer destination on outside dismissal', async () => {
	const user = userEvent.setup();
	const onselection = vi.fn();
	const { getByRole, queryByRole } = render(DropdownHarness, { onselection });
	const trigger = getByRole('button', { name: 'Options' });
	await user.click(trigger);
	await user.keyboard('{Escape}');
	expect(document.activeElement).toBe(trigger);
	expect(onselection).not.toHaveBeenCalled();
	await user.click(trigger);
	await user.click(getByRole('button', { name: 'After' }));
	expect(queryByRole('menu')).toBeNull();
	expect(document.activeElement).toBe(getByRole('button', { name: 'After' }));
});

it.each([false, true])('moves Tab relative to its trigger when fixed=%s', async (fixed) => {
	const user = userEvent.setup();
	const { getByRole, queryByRole } = render(DropdownHarness, { fixed });
	const trigger = getByRole('button', { name: 'Options' });
	await user.click(trigger);
	await user.tab();
	expect(queryByRole('menu')).toBeNull();
	expect(document.activeElement).toBe(getByRole('button', { name: 'After' }));
	await user.click(trigger);
	await user.tab({ shift: true });
	expect(document.activeElement).toBe(getByRole('button', { name: 'Before' }));
	await fireEvent.keyUp(trigger, { key: 'Tab' });
	expect(queryByRole('menu')).toBeNull();
});
