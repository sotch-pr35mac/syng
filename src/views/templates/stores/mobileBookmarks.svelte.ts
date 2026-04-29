import type { SheetSnap } from '../types/snapSheet.js';
import { createRouteState } from './routeState.svelte.js';

export const mobileBookmarksSnapStore = createRouteState<SheetSnap>('partial');
