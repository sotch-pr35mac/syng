import { fireEvent, render } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import SyButton from '@/components/SyButton/SyButton.svelte';

it('forwards an accessible name, menu state, and keyboard events to one native button', async () => {
	const onkeydown = vi.fn();
	const { getByRole, getAllByRole } = render(SyButton, {
		'aria-label': 'Import document',
		'aria-haspopup': 'menu',
		'aria-expanded': true,
		'aria-controls': 'import-options',
		id: 'import-trigger',
		tabindex: 0,
		onkeydown,
	});
	const button = getByRole('button', { name: 'Import document', expanded: true });

	expect(getAllByRole('button')).toHaveLength(1);
	expect(button.tagName).toBe('BUTTON');
	expect(button.getAttribute('aria-haspopup')).toBe('menu');
	expect(button.getAttribute('aria-controls')).toBe('import-options');
	expect(button.id).toBe('import-trigger');
	await fireEvent.keyDown(button, { key: 'ArrowDown' });
	expect(onkeydown).toHaveBeenCalledOnce();
});

it('keeps native Enter and Space activation without activating unrelated keys', async () => {
	const user = userEvent.setup();
	const onclick = vi.fn();
	const { getByRole } = render(SyButton, { 'aria-label': 'Save word', onclick });
	const button = getByRole('button', { name: 'Save word' });

	await user.tab();
	expect(document.activeElement).toBe(button);
	await user.keyboard('x{ArrowRight}');
	expect(onclick).not.toHaveBeenCalled();
	await user.keyboard('{Enter} ');
	expect(onclick).toHaveBeenCalledTimes(2);
});

it('preserves the component classes when a native class attribute is forwarded', () => {
	const { getByRole } = render(SyButton, {
		'aria-label': 'Options',
		class: 'menu-trigger',
		classes: ['existing-style'],
	});
	const button = getByRole('button', { name: 'Options' });

	expect(button.classList).toContain('sy-button');
	expect(button.classList).toContain('menu-trigger');
	expect(button.classList).toContain('existing-style');
});
