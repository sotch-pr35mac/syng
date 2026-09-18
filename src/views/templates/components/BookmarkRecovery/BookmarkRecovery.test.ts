import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { invoke } from '@tauri-apps/api/core';
import BookmarkRecovery from '@/components/BookmarkRecovery/BookmarkRecovery.svelte';
import { bookmarkRecoveryStore } from '@/stores/bookmarkRecovery.svelte.js';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

vi.mock('@/utils/error.js', () => ({ handleError: vi.fn() }));

const copyToClipboard = vi.fn();

beforeEach(() => {
	bookmarkRecoveryStore.resetForTest();
	vi.mocked(invoke).mockReset();
	copyToClipboard.mockReset();
});

afterEach(() => bookmarkRecoveryStore.resetForTest());

it('blocks until users can copy, save, or acknowledge a durable recovery report', async () => {
	const user = userEvent.setup();
	Object.defineProperty(navigator, 'clipboard', {
		configurable: true,
		value: { writeText: copyToClipboard },
	});
	bookmarkRecoveryStore.show('Legacy data: 不存在');
	const recovery = render(BookmarkRecovery);

	expect(
		recovery.getByRole('heading', { name: 'Some bookmarks need your attention' })
	).toBeTruthy();
	await user.click(recovery.getByRole('button', { name: 'Copy' }));
	expect(copyToClipboard).toHaveBeenCalledWith('Legacy data: 不存在');

	await user.click(recovery.getByRole('button', { name: 'Save' }));
	expect(invoke).toHaveBeenCalledWith('save_bookmark_recovery_report', {
		report: 'Legacy data: 不存在',
	});

	await user.click(recovery.getByRole('button', { name: 'Continue' }));
	expect(bookmarkRecoveryStore.active).toBe(false);
});
