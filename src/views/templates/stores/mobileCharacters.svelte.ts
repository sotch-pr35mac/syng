import { createRouteState } from './routeState.svelte.js';

/**
 * App-lifetime UI state for MobileCharacters. Persists the user's last chosen script
 * so returning to the screen keeps their preference rather than resetting to simplified.
 */
export const mobileCharactersScriptStore = createRouteState<'simplified' | 'traditional'>(
	'simplified'
);
