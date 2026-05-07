import { createRouteState } from '@/stores/routeState.svelte.js';

/**
 * Tracks the last active Reader document route for reader navigation state.
 * Explicitly returning to the library clears this value.
 */
export const readerDocumentRouteStore = createRouteState<string | null>(null);
