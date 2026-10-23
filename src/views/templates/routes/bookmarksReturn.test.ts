import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/svelte';
import Bookmarks from '@/routes/Bookmarks.svelte';
import MobileBookmarks from '@/routes/mobile/MobileBookmarks.svelte';
import Flashcards from '@/routes/Study/Flashcards.svelte';
import Quiz from '@/routes/Study/Quiz.svelte';
import MobileStudyFlashcards from '@/routes/mobile/Study/MobileStudyFlashcards.svelte';
import MobileStudyQuiz from '@/routes/mobile/Study/MobileStudyQuiz.svelte';
import { bookmarksStore } from '@/stores/bookmarks.svelte.js';
import { bookmarksRoute } from '@/composables/bookmarks.svelte.js';
import { exitStudy, studyOriginStore, studySubRouteStore } from '@/stores/studyRoute.svelte.js';
import { setBookmarkManagerForTest } from '@/utils/appServices.js';

vi.mock('svelte-spa-router', () => ({
	router: {
		get location() {
			return window.location.hash.slice(1).split('?')[0];
		},
		get querystring() {
			return window.location.hash.split('?')[1] ?? '';
		},
	},
}));
vi.mock('@tauri-apps/plugin-os', () => ({ platform: () => 'macos' }));
vi.mock('@/utils/error.js', () => ({ handleError: vi.fn() }));
vi.mock('@/utils/telemetry.js', () => ({
	telemetry: { trackEvent: vi.fn(() => Promise.resolve()) },
}));

let resolveLists: (names: string[]) => void;
let rejectLists: (error: Error) => void;
let startupRefresh: Promise<void>;
const getListContent = vi.fn(() => Promise.resolve([]));
const getLists = vi.fn<() => Promise<string[]>>();

beforeEach(async () => {
	vi.restoreAllMocks();
	getLists.mockReset().mockResolvedValue([]);
	setBookmarkManagerForTest({
		waitForInit: () => Promise.resolve(),
		getLists,
		getListContent,
	} as unknown as Parameters<typeof setBookmarkManagerForTest>[0]);
	await bookmarksStore.refresh();
	await bookmarksRoute.setActiveList('Bookmarks');
	vi.clearAllMocks();
	// Model a fresh startup while keeping Svelte's shared runtime intact across cases.
	let cacheReady = false;
	vi.spyOn(bookmarksStore, 'initialized', 'get').mockImplementation(() => cacheReady);
	const pendingLists = new Promise<string[]>((resolve, reject) => {
		resolveLists = resolve;
		rejectLists = reject;
	});
	getLists.mockImplementation(async () => {
		const names = await pendingLists;
		cacheReady = true;
		return names;
	});
	startupRefresh = bookmarksStore.refresh();
});

afterEach(async () => {
	cleanup();
	resolveLists([]);
	await startupRefresh;
});

describe.each([
	{ name: 'desktop', component: Bookmarks, study: { flashcards: Flashcards, quiz: Quiz } },
	{
		name: 'mobile',
		component: MobileBookmarks,
		study: { flashcards: MobileStudyFlashcards, quiz: MobileStudyQuiz },
	},
])('$name bookmark return links', ({ component, study }) => {
	it.each(['flashcards', 'quiz'] as const)(
		'returns to the originating list after exiting %s during startup',
		async (mode) => {
			const name = '词 & # 1';
			window.location.hash = `#/study/${mode}?list=${encodeURIComponent(name)}&from=bookmarks`;
			const studyView = render(study[mode]);
			expect(bookmarksStore.initialized).toBe(false);
			expect(bookmarksStore.lists).toEqual([]);
			await fireEvent.click(studyView.getByRole('button', { name: 'Exit' }));
			expect(window.location.hash).toBe(`#/bookmarks?list=${encodeURIComponent(name)}`);
			expect(studyOriginStore.value).toBeNull();
			expect(studySubRouteStore.value).toBeNull();
			studyView.unmount();
			render(component);
			await act(async () => {
				resolveLists(['Bookmarks', name]);
				await startupRefresh;
			});
			await waitFor(() => expect(bookmarksRoute.activeList).toBe(name));
			expect(getListContent).toHaveBeenLastCalledWith(name);
		}
	);

	it.each(['Existing', '词 & # 1'])('waits for startup before opening %s', async (name) => {
		window.location.hash = `#/bookmarks?list=${encodeURIComponent(name)}`;
		render(component);
		expect(bookmarksStore.initialized).toBe(false);
		expect(getListContent).not.toHaveBeenCalled();
		await act(async () => {
			resolveLists(['Bookmarks', name]);
			await startupRefresh;
		});
		await waitFor(() => expect(bookmarksRoute.activeList).toBe(name));
		expect(getListContent).toHaveBeenCalledExactlyOnceWith(name);
		expect(getLists).toHaveBeenCalledTimes(1);
	});

	it('falls back only after confirming that the requested list is absent', async () => {
		studyOriginStore.set('bookmarks');
		exitStudy('Deleted');
		render(component);
		expect(getListContent).not.toHaveBeenCalled();
		await act(async () => {
			resolveLists(['Bookmarks']);
			await startupRefresh;
		});
		await waitFor(() => expect(getListContent).toHaveBeenCalledExactlyOnceWith('Bookmarks'));
	});

	it('does not change selection after the route has unmounted', async () => {
		window.location.hash = '#/bookmarks?list=Existing';
		const view = render(component);
		view.unmount();
		await act(async () => {
			resolveLists(['Bookmarks', 'Existing']);
			await startupRefresh;
		});
		expect(bookmarksRoute.activeList).toBe('Bookmarks');
		expect(getListContent).not.toHaveBeenCalled();
	});

	it('does not replace a newer list selection when initialization finishes', async () => {
		window.location.hash = '#/bookmarks?list=Existing';
		render(component);
		await act(() => bookmarksRoute.setActiveList('Newer'));
		await act(async () => {
			resolveLists(['Bookmarks', 'Existing', 'Newer']);
			await startupRefresh;
		});
		expect(bookmarksRoute.activeList).toBe('Newer');
		expect(getListContent).toHaveBeenCalledExactlyOnceWith('Newer');
	});

	it('does not treat a failed initialization as a missing list', async () => {
		window.location.hash = '#/bookmarks?list=Existing';
		render(component);
		await act(async () => {
			rejectLists(new Error('Storage unavailable'));
			await startupRefresh;
		});
		expect(bookmarksRoute.contentStatus).toBe('error');
		expect(getListContent).not.toHaveBeenCalled();
	});
});
