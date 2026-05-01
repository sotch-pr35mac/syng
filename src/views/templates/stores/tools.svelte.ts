import { createRouteState } from '@/stores/routeState.svelte.js';
import type { ToolName } from '@/types/tools.js';

/**
 * App-lifetime UI state for the Extras route. Persists the active tab so returning
 * to Extras lands on the same tool the user was viewing.
 */
export const toolsActiveTabStore = createRouteState<ToolName>('pinyinify');
