import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import Flashcards from '@/routes/Study/Flashcards.svelte';
import MobileStudyFlashcards from '@/routes/mobile/Study/MobileStudyFlashcards.svelte';
import { bookmarksStore, type BookmarkWordEntry } from '@/stores/bookmarks.svelte.js';
import {
	flashcardsActiveIndexStore,
	flashcardsActiveListStore,
	flashcardsShowDetailsStore,
} from '@/stores/flashcards.svelte.js';
import { flashcardsRoute } from '@/composables/flashcards.svelte.js';

vi.mock('@tauri-apps/plugin-os', () => ({ platform: () => 'macos' }));
vi.mock('svelte-spa-router', () => ({
	router: {
		get querystring() {
			return window.location.hash.split('?')[1] ?? '';
		},
	},
}));
vi.mock('@/utils/index.js', () => ({
	handleError: vi.fn(),
	telemetry: { trackEvent: vi.fn(() => Promise.resolve()) },
}));
vi.mock('@/stores/bookmarks.svelte.js', () => ({
	bookmarksStore: { getContent: vi.fn(), lists: ['Week 3'], initialized: true },
}));
vi.mock('@/components/DictionaryContent/DictionaryContent.svelte', async () => ({
	default: (await import('@/components/__mocks__/RouteMock.svelte')).default,
}));
vi.mock('@/components/DictionaryPopover/DictionaryPopover.svelte', async () => ({
	default: (await import('@/components/__mocks__/RouteMock.svelte')).default,
}));

const words = Array.from({ length: 3 }, (_unused, index) => ({
	lexical_id: `1:word-${index}`,
	simplified: '词',
	traditional: '詞',
})) as BookmarkWordEntry[];

beforeEach(() => {
	vi.mocked(bookmarksStore.getContent).mockReset().mockResolvedValue(words);
	flashcardsActiveListStore.set(null);
	flashcardsActiveIndexStore.set(0);
	flashcardsShowDetailsStore.set(false);
	window.location.hash = '#/study/flashcards?list=Week%203';
});

afterEach(cleanup);

describe.each([
	{ name: 'desktop', component: Flashcards },
	{ name: 'mobile', component: MobileStudyFlashcards },
])('$name flashcard context', ({ component }) => {
	it('shows the list and current position through navigation and flipping', async () => {
		const user = userEvent.setup();
		const view = render(component);
		const status = await view.findByTestId('flashcard-status');
		expect(status.textContent.trim()).toBe('Week 3 · 1 of 3');
		expect((view.getByRole('button', { name: 'Previous' }) as HTMLButtonElement).disabled).toBe(
			true
		);

		await user.click(view.getByRole('button', { name: 'Next' }));
		expect(status.textContent.trim()).toBe('Week 3 · 2 of 3');
		await user.click(view.getByRole('button', { name: 'Flip' }));
		expect(status.textContent.trim()).toBe('Week 3 · 2 of 3');
		await user.click(view.getByRole('button', { name: 'Next' }));
		expect(status.textContent.trim()).toBe('Week 3 · 3 of 3 · Last card');
		expect((view.getByRole('button', { name: 'Next' }) as HTMLButtonElement).disabled).toBe(
			true
		);
		await user.click(view.getByRole('button', { name: 'Previous' }));
		expect(status.textContent.trim()).toBe('Week 3 · 2 of 3');
	});

	it('marks a single card as the last card', async () => {
		vi.mocked(bookmarksStore.getContent).mockResolvedValueOnce(words.slice(0, 1));
		const view = render(component);
		expect((await view.findByTestId('flashcard-status')).textContent.trim()).toBe(
			'Week 3 · 1 of 1 · Last card'
		);
	});

	it('shows the restored position and list name instead of resetting the count', async () => {
		const listName = '词 & # 1 — A longer list name for the current study session';
		window.location.hash = `#/study/flashcards?list=${encodeURIComponent(listName)}`;
		flashcardsActiveListStore.set(listName);
		flashcardsActiveIndexStore.set(1);
		flashcardsShowDetailsStore.set(true);
		const view = render(component);
		expect((await view.findByTestId('flashcard-status')).textContent.trim()).toBe(
			`${listName} · 2 of 3`
		);
		expect(flashcardsRoute.showDetails).toBe(true);
	});

	it('hides status while loading and when the list is empty', async () => {
		let finishLoading: (contents: BookmarkWordEntry[]) => void;
		vi.mocked(bookmarksStore.getContent).mockReturnValueOnce(
			new Promise((resolve) => {
				finishLoading = resolve;
			})
		);
		const view = render(component);
		expect(flashcardsRoute.loading).toBe(true);
		expect(view.queryByTestId('flashcard-status')).toBeNull();
		finishLoading([]);
		await waitFor(() => expect(flashcardsRoute.loading).toBe(false));
		expect(view.queryByTestId('flashcard-status')).toBeNull();
	});

	it('hides status after a failed list load', async () => {
		vi.mocked(bookmarksStore.getContent).mockRejectedValueOnce(
			new Error('Storage unavailable')
		);
		const view = render(component);
		await view.findByText('Unable to load flashcards. Please try again.');
		expect(view.queryByTestId('flashcard-status')).toBeNull();
	});
});
