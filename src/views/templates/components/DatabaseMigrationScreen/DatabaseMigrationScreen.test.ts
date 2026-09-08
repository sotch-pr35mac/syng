import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import DatabaseMigrationScreen from '@/components/DatabaseMigrationScreen/DatabaseMigrationScreen.svelte';
import { databaseMigrationStore } from '@/stores/databaseMigration.svelte.js';
import {
	MIGRATION_MESSAGES,
	MESSAGE_ROTATION_INTERVAL_MS,
	randomMessageIndex,
} from '@/components/DatabaseMigrationScreen/messages.js';

const RETIRED_MESSAGES = [
	'Rasterbating gigapixels...',
	'Erasing ~/ ...',
	'Trying common passwords...',
	'Covering up security breach...',
	'Archeiving internet to ~/Downloads ...',
	'Mining for bitcoin...',
	'Insufficient disk space. Reformatting...',
	'Scanning personal files...',
	'Untie-ing dyslexics...',
	'Notifying relevant government authorities...',
	'Uploading photos...',
	'Removing win32...',
	'Finding unpaid intern....',
];

beforeEach(() => {
	databaseMigrationStore.resetForTest();
	databaseMigrationStore.start({
		title: 'Updating your bookmarks…',
		detail: 'This only needs to happen once.',
	});
});

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
	databaseMigrationStore.resetForTest();
});

it('shows stable accessible status copy and keeps the joke out of the live region', () => {
	const { getByRole, getByTestId, getByText } = render(DatabaseMigrationScreen);

	expect(getByRole('heading', { name: 'Updating your bookmarks…' })).toBeTruthy();
	expect(getByText('This only needs to happen once.')).toBeTruthy();
	expect(getByRole('progressbar', { name: 'Bookmark update in progress' })).toBeTruthy();
	const joke = getByTestId('database-migration-screen').querySelector('.migration-screen__joke');
	expect(joke?.getAttribute('aria-hidden')).toBe('true');
	expect(joke?.closest('[aria-live]')).toBeNull();
});

it('chooses a random message immediately, rotates at three seconds, and skips a repeat', async () => {
	vi.useFakeTimers();
	vi.spyOn(Math, 'random').mockReturnValueOnce(0).mockReturnValueOnce(0);
	const { getByText } = render(DatabaseMigrationScreen);

	expect(getByText(MIGRATION_MESSAGES[0])).toBeTruthy();
	await vi.advanceTimersByTimeAsync(MESSAGE_ROTATION_INTERVAL_MS);
	expect(getByText(MIGRATION_MESSAGES[1])).toBeTruthy();
});

it('clears its rotation timer when it closes', () => {
	vi.useFakeTimers();
	const { unmount } = render(DatabaseMigrationScreen);
	expect(vi.getTimerCount()).toBe(1);
	unmount();
	expect(vi.getTimerCount()).toBe(0);
});

it('renders the retained error state without an indeterminate loader', () => {
	databaseMigrationStore.fail('Migration failed.');
	const { getByRole, queryByRole } = render(DatabaseMigrationScreen);

	expect(getByRole('alert').textContent).toContain('Migration failed.');
	expect(queryByRole('progressbar')).toBeNull();
});

it('contains approved messages and none of the retired messages', () => {
	expect(MIGRATION_MESSAGES).toContain(
		'Pay no attention to Caesar. Caesar doesn’t have the slightest idea what’s really going on.'
	);
	expect(MIGRATION_MESSAGES).toContain('Taking too long? Go outside!');
	expect(MIGRATION_MESSAGES).toContain('Asking AI simple questions...');
	expect(MIGRATION_MESSAGES).toContain('正在加载…');
	expect(MIGRATION_MESSAGES).toContain('Finding the measure word for migrations...');
	for (const retired of RETIRED_MESSAGES) {
		expect(MIGRATION_MESSAGES).not.toContain(retired);
	}
});

it('allows every message to be selected first', () => {
	expect(randomMessageIndex(MIGRATION_MESSAGES.length, -1, () => 0)).toBe(0);
	expect(randomMessageIndex(MIGRATION_MESSAGES.length, -1, () => 0.999999)).toBe(
		MIGRATION_MESSAGES.length - 1
	);
});
