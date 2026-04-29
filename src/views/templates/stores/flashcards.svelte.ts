import { createRouteState } from '@/stores/routeState.svelte.js';

/**
 * App-lifetime UI state for the Flashcards route. Preserves the active list, card
 * index, and flip state so that navigating away and back resumes exactly where the
 * user left off. The flip state is reset when moving between cards, but preserved
 * across navigation.
 */
export const flashcardsActiveListStore = createRouteState<string | null>(null);
export const flashcardsActiveIndexStore = createRouteState<number>(0);
export const flashcardsShowDetailsStore = createRouteState<boolean>(false);
