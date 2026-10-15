import { bookmarksStore } from '@/stores/bookmarks.svelte.js';
import type { StudyOrigin, StudyContentStatus, StudyListSummary } from '@/composables/study.js';
import { handleError } from '@/utils/index.js';
import { createRouteState } from '@/stores/routeState.svelte.js';

export type StudySubRoute = 'flashcards' | 'quiz' | null;

/**
 * Tracks the last active Study sub-route so Study.svelte can restore navigation state.
 * Sub-routes write to this store on mount; Study reads it on mount to decide whether to
 * redirect. Flashcards clears it on explicit exit so Study shows the list rather than
 * immediately redirecting again.
 */
export const studySubRouteStore = createRouteState<StudySubRoute>(null);

// Like the sub-route, origin survives switching tabs but is cleared by ordinary Study launches.
export const studyOriginStore = createRouteState<StudyOrigin>(null);

export function exitStudy(list: string | null): void {
	studySubRouteStore.set(null);
	if (studyOriginStore.value === 'bookmarks') {
		// The cache may still be loading; Bookmarks validates the list after initialization.
		const returnList = list || 'Bookmarks';
		window.location.hash = `#/bookmarks?list=${encodeURIComponent(returnList)}`;
	} else {
		window.location.hash = '#/study';
	}
	studyOriginStore.set(null);
}

export function createStudyListState() {
	let status = $state<StudyContentStatus>('loading');
	let lists = $state<StudyListSummary[]>([]);
	let loadRequest = 0;
	return {
		get status() {
			return status;
		},
		get lists() {
			return lists;
		},
		async load(): Promise<void> {
			const requestId = ++loadRequest;
			status = 'loading';
			try {
				const summaries = await bookmarksStore.getListSummaries();
				if (requestId !== loadRequest) {
					return;
				}
				lists = summaries
					.filter((list) => list.wordCount > 0)
					.sort((first, second) => first.name.localeCompare(second.name));
				status = 'ready';
			} catch (error) {
				if (requestId !== loadRequest) {
					return;
				}
				status = 'error';
				handleError('There was an error fetching study lists. Please try again.', error);
			}
		},
		cancel(): void {
			loadRequest += 1;
		},
	};
}
