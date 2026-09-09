import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import DatabaseMigrationScreen from '@/components/DatabaseMigrationScreen/DatabaseMigrationScreen.svelte';
import { databaseMigrationStore } from '@/stores/databaseMigration.svelte.js';
import {
	LOADING_MESSAGES,
	MESSAGE_ROTATION_INTERVAL_MS,
	randomMessageIndex,
} from '@/components/LoadingScreen/messages.js';

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
	"Determining size of CC-CEDICT file ... It's Over 9000!",
	'Level up!',
	'Preparing DOS run-time environment',
	'Bitmapping...',
	'Making bacon pancakes...',
	'Negotiating with a polyphonic character...',
	'Teaching old bookmarks new levels...',
	'Consulting the radical council...',
	'Counting strokes twice...',
	'Looking up how to look things up...',
	'Checking whether 行 is háng or xíng...',
	'Reuniting bookmarks with their HSK levels...',
	'Cross-referencing three HSK timelines...',
	'Giving levels seven through nine some personal space...',
	'Finding the measure word for migrations...',
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

it('shows stable accessible status copy without a loading indicator and keeps the joke out of the live region', () => {
	const { getByRole, getByTestId, getByText, queryByRole } = render(DatabaseMigrationScreen);

	expect(getByRole('heading', { name: 'Updating your bookmarks…' })).toBeTruthy();
	expect(getByText('This only needs to happen once.')).toBeTruthy();
	expect(queryByRole('progressbar')).toBeNull();
	const joke = getByTestId('database-migration-screen').querySelector('.loading-screen__message');
	expect(joke?.getAttribute('aria-hidden')).toBe('true');
	expect(joke?.closest('[aria-live]')).toBeNull();
});

it('chooses a random message immediately, rotates at three seconds, and skips a repeat', async () => {
	vi.useFakeTimers();
	vi.spyOn(Math, 'random').mockReturnValueOnce(0).mockReturnValueOnce(0);
	const { getByText } = render(DatabaseMigrationScreen);

	expect(getByText(LOADING_MESSAGES[0])).toBeTruthy();
	await vi.advanceTimersByTimeAsync(MESSAGE_ROTATION_INTERVAL_MS);
	expect(getByText(LOADING_MESSAGES[1])).toBeTruthy();
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

it('allows a settings preview to close without making real migrations dismissible', async () => {
	const user = userEvent.setup();
	databaseMigrationStore.startPreview({
		title: 'Updating your bookmarks…',
		detail: 'This only needs to happen once.',
	});
	const preview = render(DatabaseMigrationScreen);

	await user.click(preview.getByRole('button', { name: 'Close preview' }));
	expect(databaseMigrationStore.active).toBe(false);
	preview.unmount();

	databaseMigrationStore.start({
		title: 'Updating your bookmarks…',
		detail: 'This only needs to happen once.',
	});
	const migration = render(DatabaseMigrationScreen);
	expect(migration.queryByRole('button', { name: 'Close preview' })).toBeNull();
});

it('contains approved messages and none of the retired messages', () => {
	expect(LOADING_MESSAGES).toContain(
		'Pay no attention to Caesar. Caesar doesn’t have the slightest idea what’s really going on.'
	);
	expect(LOADING_MESSAGES).toContain('Taking too long? Go outside!');
	expect(LOADING_MESSAGES).toContain('Asking AI simple questions...');
	expect(LOADING_MESSAGES).toContain('Asking AI what to do next…');
	expect(LOADING_MESSAGES).toContain('正在加载…');
	for (const retired of RETIRED_MESSAGES) {
		expect(LOADING_MESSAGES).not.toContain(retired);
	}
});

it('uses the v1.5.0 gradient and a softer dark-mode shimmer only on the full-size joke copy', async () => {
	const source = (await import('../LoadingScreen/LoadingScreen.svelte?raw')).default;
	const jokeRule = source.match(/\.loading-screen__message\s*\{([^}]*)\}/)?.[1] ?? '';

	expect(source).toContain('background: linear-gradient(#ff8a00, #ef1063, #9d29ad);');
	expect(jokeRule).toContain('font-size: var(--sy-font-size--normal)');
	expect(jokeRule).toContain('animation: loading-shimmer');
	expect(source.match(/animation: loading-shimmer/g)).toHaveLength(1);
	expect(source).toContain('@media (prefers-color-scheme: dark)');
	expect(source).toContain('rgb(35 35 35 / 78%) 50%');
});

it('allows every message to be selected first', () => {
	expect(randomMessageIndex(LOADING_MESSAGES.length, -1, () => 0)).toBe(0);
	expect(randomMessageIndex(LOADING_MESSAGES.length, -1, () => 0.999999)).toBe(
		LOADING_MESSAGES.length - 1
	);
});
