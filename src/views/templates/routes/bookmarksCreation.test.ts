import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import Bookmarks from '@/routes/Bookmarks.svelte';
import MobileBookmarks from '@/routes/mobile/MobileBookmarks.svelte';
import { bookmarksRoute } from '@/composables/bookmarks.svelte.js';
import { bookmarksStore, type BookmarkWordEntry } from '@/stores/bookmarks.svelte.js';
import { bookmarksActiveWordStore } from '@/stores/bookmarksRoute.svelte.js';
import { mobileCharacterWindowWordStore } from '@/stores/mobileCharacterWindowWord.svelte.js';
import { mobileBookmarksSnapStore } from '@/stores/mobileBookmarks.svelte.js';
import { setBookmarkManagerForTest } from '@/utils/appServices.js';
import { handleError } from '@/utils/error.js';
import { telemetry } from '@/utils/telemetry.js';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(() => Promise.resolve(null)) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ ask: vi.fn(() => Promise.resolve(false)) }));
vi.mock('@tauri-apps/plugin-os', () => ({ platform: () => 'macos' }));
vi.mock('@/utils/error.js', () => ({ handleError: vi.fn() }));
vi.mock('@/utils/telemetry.js', () => ({
	telemetry: { trackEvent: vi.fn(() => Promise.resolve()) },
}));

const savedWord = {
	_id: 'word-1',
	_rev: '1',
	lexical_id: '1:xigua',
	traditional: '西瓜',
	simplified: '西瓜',
	english: ['watermelon'],
	pinyin_marks: 'xī guā',
	tone_marks: [1, 1],
	measure_words: [],
	lists: ['Bookmarks'],
	notes: '',
} as unknown as BookmarkWordEntry;
let listNames: string[];
const persistList = vi.fn<(name: string) => Promise<void>>();

beforeEach(async () => {
	vi.clearAllMocks();
	listNames = ['Bookmarks', 'Existing'];
	persistList.mockReset();
	persistList.mockImplementation(async (name) => {
		listNames.push(name);
	});
	setBookmarkManagerForTest({
		waitForInit: () => Promise.resolve(),
		getLists: () => Promise.resolve(listNames),
		getListContent: (name: string) => Promise.resolve(name === 'Bookmarks' ? [savedWord] : []),
		createList: persistList,
		inList: () => Promise.resolve(['Bookmarks']),
	} as unknown as Parameters<typeof setBookmarkManagerForTest>[0]);
	await bookmarksStore.refresh();
	await bookmarksRoute.setActiveList('Bookmarks');
	bookmarksRoute.clearCreationError();
	mobileBookmarksSnapStore.set('full');
});

afterEach(cleanup);

describe.each([
	['desktop', Bookmarks],
	['mobile', MobileBookmarks],
] as const)('%s list creation', (_surface, component) => {
	async function openCreateDialog() {
		const user = userEvent.setup();
		const view = render(component);
		const trigger = view.container.querySelector('.sy-dropdown--trigger') as HTMLElement;
		await user.click(trigger);
		await user.click(await screen.findByText('Create New'));
		const input = view.container.querySelector('#create-new-list-input') as HTMLInputElement;
		const modal = view.container.querySelector('.sy-modal--container') as HTMLElement;
		const createButton = screen.getByRole('button', { name: /^Create$/ });
		return { ...view, user, input, modal, createButton };
	}

	it.each([
		['   ', 'Enter a name for your list.'],
		['Existing', 'A list with this name already exists.'],
		['Bookmarks', 'This name is reserved. Choose another name.'],
		['create-new', 'This name is reserved. Choose another name.'],
	])('keeps the form and explains invalid name %j', async (name, message) => {
		const { user, input, modal, createButton } = await openCreateDialog();
		await user.type(input, name);
		await user.click(createButton);

		expect(await screen.findByText(message)).toBeTruthy();
		expect(input.value).toBe(name);
		expect(modal.classList.contains('sy-modal--active')).toBe(true);
		expect((createButton as HTMLButtonElement).disabled).toBe(false);
		expect(persistList).not.toHaveBeenCalled();
		expect(handleError).not.toHaveBeenCalled();

		await user.type(input, 'x');
		expect(screen.queryByText(message)).toBeNull();
	});

	it('opens the trimmed new list and clears the prior filter and selected word', async () => {
		const { user, input, modal, createButton } = await openCreateDialog();
		bookmarksRoute.setActiveWord(savedWord);
		const filterInput = screen.getByPlaceholderText('Filter') as HTMLInputElement;
		await user.type(filterInput, 'watermelon');
		await user.type(input, '  existing  ');
		await user.click(createButton);

		await waitFor(() => expect(bookmarksRoute.activeList).toBe('existing'));
		expect(persistList).toHaveBeenCalledExactlyOnceWith('existing');
		expect(bookmarksActiveWordStore.value).toBeUndefined();
		expect(mobileCharacterWindowWordStore.value).toBeUndefined();
		expect(filterInput.value).toBe('');
		expect(input.value).toBe('');
		expect(modal.classList.contains('sy-modal--active')).toBe(false);
		expect(telemetry.trackEvent).toHaveBeenCalledWith('list.created', {});
	});

	it('preserves a failed save for retry without allowing duplicate submissions', async () => {
		let rejectSave!: (error: Error) => void;
		persistList.mockImplementationOnce(
			() =>
				new Promise((_resolve, reject) => {
					rejectSave = reject;
				})
		);
		const { user, input, modal, createButton } = await openCreateDialog();
		await user.type(input, 'My vocabulary');
		await user.click(createButton);
		await user.click(createButton);
		expect(persistList).toHaveBeenCalledTimes(1);
		expect((createButton as HTMLButtonElement).disabled).toBe(true);

		rejectSave(new Error('Storage unavailable'));
		expect(
			await screen.findByText('Could not create this list. Please try again.')
		).toBeTruthy();
		expect(input.value).toBe('My vocabulary');
		expect(modal.classList.contains('sy-modal--active')).toBe(true);
		expect((createButton as HTMLButtonElement).disabled).toBe(false);
		expect(handleError).toHaveBeenCalledWith(expect.any(String), expect.any(Error), {
			silent: true,
			telemetryMessage: 'List creation failed.',
			privateValues: ['My vocabulary'],
		});
		await user.click(createButton);
		await waitFor(() => expect(bookmarksRoute.activeList).toBe('My vocabulary'));
		expect(persistList).toHaveBeenCalledTimes(2);
		expect(modal.classList.contains('sy-modal--active')).toBe(false);
	});

	it('does not close a reopened form when a cancelled save finishes', async () => {
		let completeSave!: () => void;
		persistList.mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					completeSave = resolve;
				})
		);
		const { user, input, modal, createButton, container } = await openCreateDialog();
		await user.type(input, 'First list');
		await user.click(createButton);
		await user.click(screen.getByRole('button', { name: 'Cancel' }));
		await user.click(container.querySelector('.sy-dropdown--trigger') as HTMLElement);
		await user.click(await screen.findByText('Create New'));
		await user.type(input, 'Second list');
		completeSave();

		await waitFor(() => expect((createButton as HTMLButtonElement).disabled).toBe(false));
		expect(input.value).toBe('Second list');
		expect(modal.classList.contains('sy-modal--active')).toBe(true);
		expect(bookmarksRoute.activeList).toBe('Bookmarks');
	});

	it('clears the name and validation when cancelled', async () => {
		const { user, input, modal, createButton } = await openCreateDialog();
		await user.type(input, 'Existing');
		await user.click(createButton);
		await user.click(screen.getByRole('button', { name: 'Cancel' }));
		expect(input.value).toBe('');
		expect(bookmarksRoute.creationError).toBe('');
		expect(modal.classList.contains('sy-modal--active')).toBe(false);
	});
});
