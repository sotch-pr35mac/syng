import type { SheetSnap } from '@/types/snapSheet.js';
import { createRouteState } from '@/stores/routeState.svelte.js';

/**
 * App-lifetime UI state for MobileSearch. Both fields are cheap primitives — a string
 * for the search input text and a union for the snap sheet position.
 */
export const mobileSearchQueryStore = createRouteState('');
export const mobileSearchSnapStore = createRouteState<SheetSnap>('collapsed');
