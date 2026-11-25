import { createRouteState } from '@/stores/routeState.svelte.js';
import type { ToolName } from '@/types/tools.js';

/** App-lifetime Extras selection. null shows the toolbox; tool data lives in toolsStore. */
export const toolsSelectionStore = createRouteState<ToolName | null>(null);
