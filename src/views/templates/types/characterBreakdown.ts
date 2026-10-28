import type { CharacterScript } from '@/types/dictionaryDisplay.js';
export type ComponentRole =
	| 'meaning'
	| 'sound'
	| 'iconic'
	| 'remnant'
	| 'distinguishing'
	| 'unknown'
	| 'simplified'
	| 'deleted';
export interface CharacterGeometry {
	strokes: string[];
	medians: [number, number][][];
}
export interface BreakdownComponent {
	character: string | null;
	roles: ComponentRole[];
	note: string;
	strokes?: number[];
	changedForm?: boolean;
	historicalSound?: boolean;
	originalMeaning?: boolean;
}
export interface CharacterBreakdownRecord {
	character: string;
	verified: boolean;
	formation: string;
	components: BreakdownComponent[];
	radical?: string;
	strokeCount?: number;
	/** Inline vectors or an app-relative packaged JSON resource; licensing lives in data metadata. */
	glyph?: ({ kind: 'inline' } & CharacterGeometry) | { kind: 'resource'; path: string };
}
export interface BreakdownSelection {
	script: CharacterScript;
	index: number;
	pinned: number | null;
}
export const COMPONENT_ROLES: Record<ComponentRole, string> = {
	meaning: 'Meaning',
	sound: 'Sound',
	iconic: 'Iconic',
	remnant: 'Remnant',
	distinguishing: 'Distinguishing',
	unknown: 'Unknown',
	simplified: 'Simplified',
	deleted: 'Deleted',
};
