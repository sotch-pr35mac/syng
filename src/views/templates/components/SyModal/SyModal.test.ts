import { render, fireEvent, waitFor } from '@testing-library/svelte';
import { expect, it, vi } from 'vitest';
import SyModal from '@/components/SyModal/SyModal.svelte';

vi.mock('@tauri-apps/plugin-os', () => ({ platform: () => 'unknown' }));

it('names the dialog, initially focuses its heading, closes on Escape and restores focus', async () => {
	const opener = document.createElement('button');
	document.body.appendChild(opener);
	opener.focus();
	const onclose = vi.fn();
	const { getByRole, rerender } = render(SyModal, {
		visible: true,
		title: 'Import document',
		onclose,
	});
	const dialog = getByRole('dialog', { name: 'Import document' });
	expect(dialog.getAttribute('aria-modal')).toBe('true');
	await waitFor(() =>
		expect(document.activeElement).toBe(getByRole('heading', { name: 'Import document' }))
	);
	await fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
	expect(onclose).toHaveBeenCalledOnce();
	await rerender({ visible: false, title: 'Import document', onclose });
	expect(document.activeElement).toBe(opener);
	opener.remove();
});

it('hides the close action and ignores Escape for recovery dialogs', async () => {
	const onclose = vi.fn();
	const { getByRole, queryByRole } = render(SyModal, {
		visible: true,
		title: 'Recovery',
		dismissible: false,
		onclose,
	});
	expect(queryByRole('button', { name: 'Close dialog' })).toBeNull();
	await fireEvent.keyDown(getByRole('dialog', { name: 'Recovery' }), { key: 'Escape' });
	expect(onclose).not.toHaveBeenCalled();
});

it('resolves an optional initial focus target after the dialog mounts', async () => {
	const { getByRole } = render(SyModal, {
		visible: true,
		title: 'Confirm',
		initialFocus: () => document.querySelector<HTMLElement>('[aria-label="Close dialog"]'),
	});
	await waitFor(() =>
		expect(document.activeElement).toBe(getByRole('button', { name: 'Close dialog' }))
	);
});
