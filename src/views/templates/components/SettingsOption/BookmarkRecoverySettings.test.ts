import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { invoke } from '@tauri-apps/api/core';
import BookmarkRecoverySettings from '@/components/SettingsOption/BookmarkRecoverySettings.svelte';
import BookmarkRecovery from '@/components/BookmarkRecovery/BookmarkRecovery.svelte';
import { bookmarkRecoveryStore } from '@/stores/bookmarkRecovery.svelte.js';
import { handleError } from '@/utils/error.js';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('@/utils/error.js', () => ({ handleError: vi.fn() }));
vi.mock('@/utils/device.js', () => ({ isMobile: () => true }));

beforeEach(() => {
	vi.mocked(invoke).mockReset();
	vi.mocked(handleError).mockClear();
	bookmarkRecoveryStore.resetForTest();
});

afterEach(() => bookmarkRecoveryStore.resetForTest());

it('reopens durable history after Continue and a fresh session, with copy and save available', async () => {
	const user = userEvent.setup();
	const copyToClipboard = vi.fn();
	Object.defineProperty(navigator, 'clipboard', {
		configurable: true,
		value: { writeText: copyToClipboard },
	});
	const history = 'First import: 银行\n\n==========\n\nSecond import: 数';
	vi.mocked(invoke).mockImplementation(async (command) =>
		command === 'read_bookmark_recovery_report' ? history : undefined
	);
	const settings = render(BookmarkRecoverySettings);
	const recovery = render(BookmarkRecovery);

	bookmarkRecoveryStore.show('Second import: 数');
	await user.click(recovery.getByRole('button', { name: 'Continue' }));
	expect(bookmarkRecoveryStore.active).toBe(false);

	await user.click(settings.getByRole('button', { name: 'View recovery reports' }));
	expect(bookmarkRecoveryStore.report).toBe(history);
	await user.click(recovery.getByRole('button', { name: 'Copy' }));
	expect(copyToClipboard).toHaveBeenCalledWith(history);
	await user.click(recovery.getByRole('button', { name: 'Save' }));
	expect(invoke).toHaveBeenCalledWith('save_bookmark_recovery_report', { report: history });

	bookmarkRecoveryStore.resetForTest();
	await user.click(settings.getByRole('button', { name: 'View recovery reports' }));
	expect(bookmarkRecoveryStore.active).toBe(true);
	expect(bookmarkRecoveryStore.report).toBe(history);
	expect(
		vi
			.mocked(invoke)
			.mock.calls.filter(([command]) => command === 'read_bookmark_recovery_report')
	).toHaveLength(2);
});

it.each([null, '', ' \n '])(
	'shows an empty state for missing or empty saved reports (%s)',
	async (report) => {
		const user = userEvent.setup();
		vi.mocked(invoke).mockResolvedValue(report);
		const settings = render(BookmarkRecoverySettings);
		await user.click(settings.getByRole('button', { name: 'View recovery reports' }));
		expect(settings.getByRole('status').textContent).toBe('No saved recovery reports.');
		expect(bookmarkRecoveryStore.active).toBe(false);
	}
);

it('surfaces read failures and allows a subsequent retry', async () => {
	const user = userEvent.setup();
	const error = new Error('Permission denied');
	vi.mocked(invoke).mockRejectedValueOnce(error).mockResolvedValueOnce('Recovered history');
	const settings = render(BookmarkRecoverySettings);
	await user.click(settings.getByRole('button', { name: 'View recovery reports' }));
	expect(handleError).toHaveBeenCalledWith('Could not read the bookmark recovery report.', error);
	expect(settings.queryByRole('status')).toBeNull();
	expect(bookmarkRecoveryStore.active).toBe(false);
	await user.click(settings.getByRole('button', { name: 'View recovery reports' }));
	expect(bookmarkRecoveryStore.report).toBe('Recovered history');
});
