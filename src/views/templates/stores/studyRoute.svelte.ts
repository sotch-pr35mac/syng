import { createRouteState } from '@/stores/routeState.svelte.js';

export type StudySubRoute = 'flashcards' | 'quiz' | null;

/**
 * Tracks the last active Study sub-route so Study.svelte can restore navigation state.
 * Sub-routes write to this store on mount; Study reads it on mount to decide whether to
 * redirect. Flashcards clears it on explicit exit so Study shows the list rather than
 * immediately redirecting again.
 */
export const studySubRouteStore = createRouteState<StudySubRoute>(null);
