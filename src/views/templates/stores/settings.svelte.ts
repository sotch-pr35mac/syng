import { createRouteState } from './routeState.svelte.js';

/**
 * App-lifetime UI state for the Settings route. Persists the active tab so returning
 * to Settings lands on the same tab the user was viewing.
 */
export const settingsActiveTabStore = createRouteState<string>('general');
