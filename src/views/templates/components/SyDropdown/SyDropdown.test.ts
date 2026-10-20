import { render, fireEvent } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { tick } from 'svelte';
import DropdownHarness from '@/components/SyDropdown/DropdownHarness.test.svelte';

vi.mock('@tauri-apps/plugin-os', () => ({ platform: () => 'unknown' }));

afterEach(() => vi.restoreAllMocks());

it('follows a moving fixed trigger and stops frame tracking on close and destruction', async () => {
	const frames = new Map<number, FrameRequestCallback>();
	let nextFrame = 0;
	vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
		nextFrame += 1;
		frames.set(nextFrame, callback);
		return nextFrame;
	});
	vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((frame) => {
		frames.delete(frame);
	});
	const { getByRole, queryByRole, unmount } = render(DropdownHarness, { fixed: true });
	const trigger = getByRole('button', { name: 'Options' });
	let triggerTop = 300;
	vi.spyOn(trigger, 'getBoundingClientRect').mockImplementation(
		() => new DOMRect(100, triggerTop, 80, 40)
	);
	expect(frames.size).toBe(0);
	await fireEvent.click(trigger);
	const menu = getByRole('menu');
	expect(menu.style.top).toBe('344px');
	triggerTop = 220;
	const [frame, callback] = [...frames.entries()][0];
	frames.delete(frame);
	callback(16);
	await tick();
	expect(menu.style.top).toBe('264px');
	expect(frames.size).toBe(1);
	await fireEvent.keyDown(menu, { key: 'Escape' });
	expect(queryByRole('menu')).toBeNull();
	expect(frames.size).toBe(0);
	await fireEvent.click(trigger);
	expect(frames.size).toBe(1);
	unmount();
	expect(frames.size).toBe(0);
});

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

it.each([
	[false, '{Enter}'],
	[false, ' '],
	[true, '{Enter}'],
	[true, ' '],
] as const)(
	'selects exactly once with fixed=%s and key=%s and restores focus',
	async (fixed, key) => {
		const user = userEvent.setup();
		const onselection = vi.fn();
		const { getByRole, queryByRole } = render(DropdownHarness, { fixed, onselection });
		const trigger = getByRole('button', { name: 'Options' });
		trigger.focus();
		await user.keyboard('{ArrowDown}');
		await user.keyboard(key);
		expect(onselection).toHaveBeenCalledExactlyOnceWith('alpha');
		expect(queryByRole('menu')).toBeNull();
		expect(document.activeElement).toBe(trigger);
	}
);

it('does not select an icon item when navigating with arrow keys', async () => {
	const user = userEvent.setup();
	const onselection = vi.fn();
	const { getByRole } = render(DropdownHarness, { iconItems: true, onselection });
	await user.click(getByRole('button', { name: 'Options' }));
	await user.keyboard('{ArrowDown}');
	expect(document.activeElement).toBe(getByRole('menuitem', { name: 'Beta' }));
	expect(onselection).not.toHaveBeenCalled();
	await user.keyboard(' ');
	expect(onselection).toHaveBeenCalledExactlyOnceWith('beta');
});

it.each([false, true])(
	'prevents disabled options from being selected (icons=%s)',
	async (iconItems) => {
		const onselection = vi.fn();
		const { getByRole } = render(DropdownHarness, { iconItems, onselection });
		await fireEvent.click(getByRole('button', { name: 'Options' }));
		const item = getByRole('menuitem', { name: 'Disabled' });
		expect(item).toHaveProperty('disabled', true);
		await fireEvent.click(item);
		expect(onselection).not.toHaveBeenCalled();
	}
);

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
