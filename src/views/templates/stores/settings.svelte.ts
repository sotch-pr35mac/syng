import { createRouteState } from '@/stores/routeState.svelte.js';

/**
 * App-lifetime UI state for the Settings route. Persists the active tab so returning
 * to Settings lands on the same tab the user was viewing.
 */
export const settingsActiveTabStore = createRouteState<string>('general');

export type SettingsLayout = 'desktop' | 'mobile';
export type SettingsTab = 'general' | 'telemetry' | 'acknowledgements';

// Session-only positions, kept separate from persisted user preferences.
const scrollPositions: Partial<Record<`${SettingsLayout}:${SettingsTab}`, number>> = {};

export const settingsScrollStore = {
	get(layout: SettingsLayout, tab: SettingsTab): number | undefined {
		return scrollPositions[`${layout}:${tab}`];
	},
	set(layout: SettingsLayout, tab: SettingsTab, position: number): void {
		scrollPositions[`${layout}:${tab}`] = position;
	},
	resetForTest(): void {
		for (const key of Object.keys(scrollPositions)) {
			delete scrollPositions[key as keyof typeof scrollPositions];
		}
	},
};
