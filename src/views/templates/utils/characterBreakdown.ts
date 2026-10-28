/**
 * Offline character records, shared stroke geometry, and component hit testing.
 * All fetches read packaged resources; dictionary lookups use the native database.
 * Session promise caches share concurrent reads and avoid parsing the same file
 * on every visit. Packaged assets are immutable during a session, so failed reads
 * remain cached and are surfaced to the caller without retrying.
 */
import { lookupDictionary } from '@/utils/dictionaryLookup.js';
import type { SearchEntry } from '@/types/search.js';
import type { CharacterBreakdownRecord, CharacterGeometry } from '@/types/characterBreakdown.js';
const HEX_RADIX = 16;
const ROOT = 'resources/character-breakdown';
const records = new Map<string, Promise<CharacterBreakdownRecord | null>>();
const geometry = new Map<string, Promise<CharacterGeometry | null>>();
const dictionary = new Map<string, Promise<SearchEntry[]>>();
let indexPromise: Promise<Record<string, number>> | undefined;
let radicalsPromise: Promise<{ radicals: Record<string, string> }> | undefined;
const characterKey = (character: string) =>
	[...character].map((c) => c.codePointAt(0).toString(HEX_RADIX)).join('-');
/** Read a bundled JSON resource, treating the dev server's HTML fallback as failure. */
async function json<T>(url: string): Promise<T> {
	try {
		const response = await fetch(url);
		if (!response.ok) {
			throw new Error(`HTTP ${response.status}`);
		}
		// A missing static file can fall back to index.html with a successful status.
		if (response.headers.get('content-type')?.includes('text/html')) {
			throw new Error('Received HTML instead of character JSON');
		}
		return await response.json();
	} catch (error) {
		throw new Error(`Could not load character data: ${url}`, { cause: error });
	}
}
/** Load the generated character/eligibility index once; absence is distinct from load failure. */
export function breakdownIndex(): Promise<Record<string, number>> {
	indexPromise ??= json<Record<string, number>>(`${ROOT}/index.json`);
	return indexPromise;
}
/** Read a Unicode-keyed record; null means unsupported, while missing/corrupt assets reject. */
export async function loadBreakdown(character: string): Promise<CharacterBreakdownRecord | null> {
	const index = await breakdownIndex();
	if (!Object.prototype.hasOwnProperty.call(index, character)) {
		return null;
	}
	if (!records.has(character)) {
		// LGPL radical fields are packaged separately from the CC BY-SA character notes.
		radicalsPromise ??= json<{ radicals: Record<string, string> }>(`${ROOT}/radicals.json`);
		records.set(
			character,
			Promise.all([
				json<CharacterBreakdownRecord>(`${ROOT}/chars/${characterKey(character)}.json`),
				radicalsPromise,
			]).then(([record, { radicals }]) => ({ ...record, radical: radicals[character] }))
		);
	}
	return records.get(character);
}
/** Read inline vectors or their declared packaged resource; null permits a font-only glyph. */
export function loadBreakdownGeometry(
	record: CharacterBreakdownRecord
): Promise<CharacterGeometry | null> {
	if (record.glyph?.kind === 'inline') {
		return Promise.resolve(record.glyph);
	}
	if (record.glyph?.kind !== 'resource') {
		return Promise.resolve(null);
	}
	const { path } = record.glyph;
	if (!geometry.has(path)) {
		geometry.set(path, json<CharacterGeometry>(path));
	}
	return geometry.get(path);
}
/** Only real, exact entries become links; prefix matches must not masquerade as a radical. */
export function lookupCharacter(character: string): Promise<SearchEntry[]> {
	if (!character || character === '◎') {
		return Promise.resolve([]);
	}
	if (!dictionary.has(character)) {
		dictionary.set(
			character,
			lookupDictionary({ text: character, exactOnly: true }).then(({ results }) => results)
		);
	}
	return dictionary.get(character);
}
/** Shortest distance to one stroke-median segment, in the source glyph coordinate system. */
function segmentDistance(x: number, y: number, a: number[], b: number[]): number {
	const dx = b[0] - a[0],
		dy = b[1] - a[1],
		length = dx * dx + dy * dy;
	const t = length ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / length)) : 0;
	return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy);
}
/**
 * Choose the nearest mapped component anywhere in the glyph, including between strokes.
 * Coordinates must use the geometry's source space. Keep the prior component near
 * boundaries to avoid flicker; null means no usable component-to-stroke mapping.
 */
export function nearestComponent(
	record: CharacterBreakdownRecord,
	data: CharacterGeometry,
	x: number,
	y: number,
	prior: number | null
): number | null {
	const distances = record.components.map((p) => {
		let best = Infinity;
		for (const index of p.strokes ?? []) {
			const line = data.medians[index] ?? [];
			for (let i = 1; i < line.length; i++) {
				best = Math.min(best, segmentDistance(x, y, line[i - 1], line[i]));
			}
		}
		return best;
	});
	const best = distances.indexOf(Math.min(...distances));
	if (best < 0 || !Number.isFinite(distances[best])) {
		return null;
	}
	const BOUNDARY_TOLERANCE = 28;
	return prior !== null && distances[prior] <= distances[best] + BOUNDARY_TOLERANCE
		? prior
		: best;
}
