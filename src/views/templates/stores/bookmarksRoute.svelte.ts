import type { BookmarkWordEntry } from '@/stores/bookmarks.svelte.js';
import { createRouteState } from '@/stores/routeState.svelte.js';

/**
 * App-lifetime UI state for the Bookmarks route. Persists which list is active and
 * which word is selected so returning to Bookmarks restores the view exactly.
 *
 * Note: Syng always expects a list named 'Bookmarks' to exist — it is the default list
 * and is excluded from deletion (see restrictedListNames in Bookmarks.svelte). The
 * default value here reflects that invariant.
 */
// Syng always expects a list named 'Bookmarks' to exist.
export const bookmarksActiveListStore = createRouteState<string>('Bookmarks');
export const bookmarksActiveWordStore = createRouteState<BookmarkWordEntry | undefined>(undefined);
