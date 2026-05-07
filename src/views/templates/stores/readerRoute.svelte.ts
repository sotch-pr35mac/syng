import { createRouteState } from '@/stores/routeState.svelte.js';

/**
 * Tracks the last active Reader document route so Reader.svelte can restore navigation
 * state when the user returns via the top-level Read navigation item. Explicitly
 * returning to the library clears this value.
 */
export const readerDocumentRouteStore = createRouteState<string | null>(null);
