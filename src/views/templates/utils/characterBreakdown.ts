import { lookupDictionary } from '@/utils/dictionaryLookup.js';
import type { SearchEntry } from '@/types/search.js';
import type { CharacterBreakdownRecord, CharacterGeometry } from '@/types/characterBreakdown.js';
const HEX_RADIX = 16;
const ROOT = 'resources/character-breakdown';
const records = new Map<string, Promise<CharacterBreakdownRecord | null>>();
const geometry = new Map<string, Promise<CharacterGeometry | null>>();
const dictionary = new Map<string, Promise<SearchEntry[]>>();
let indexPromise: Promise<Record<string, number>> | undefined;
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
export function breakdownIndex(): Promise<Record<string, number>> {
	indexPromise ??= json<Record<string, number>>(`${ROOT}/index.json`).catch((error) => {
		indexPromise = undefined;
		throw error;
	});
	return indexPromise;
}
export async function loadBreakdown(character: string): Promise<CharacterBreakdownRecord | null> {
	const index = await breakdownIndex();
	if (!Object.prototype.hasOwnProperty.call(index, character)) {
		return null;
	}
	if (!records.has(character)) {
		const key = [...character].map((c) => c.codePointAt(0).toString(HEX_RADIX)).join('-');
		records.set(
			character,
			json<CharacterBreakdownRecord>(`${ROOT}/chars/${key}.json`).catch((error) => {
				records.delete(character);
				throw error;
			})
		);
	}
	return records.get(character);
}
export function loadBreakdownGeometry(
	record: CharacterBreakdownRecord
): Promise<CharacterGeometry | null> {
	if (record.glyph?.kind === 'inline') {
		return Promise.resolve(record.glyph);
	}
	if (record.glyph?.kind !== 'bundled') {
		return Promise.resolve(null);
	}
	if (!geometry.has(record.character)) {
		geometry.set(
			record.character,
			json<CharacterGeometry>(
				`resources/hanzi-writer-data/data/${encodeURIComponent(record.character)}.json`
			).catch((error) => {
				geometry.delete(record.character);
				throw error;
			})
		);
	}
	return geometry.get(record.character);
}
/** Only real, exact entries become links; prefix matches must not masquerade as a radical. */
export function lookupCharacter(character: string): Promise<SearchEntry[]> {
	if (!character || character === '◎') {
		return Promise.resolve([]);
	}
	if (!dictionary.has(character)) {
		dictionary.set(
			character,
			lookupDictionary({ text: character, exactOnly: true })
				.then(({ results }) => results)
				.catch((error) => {
					dictionary.delete(character);
					throw error;
				})
		);
	}
	return dictionary.get(character);
}
function segmentDistance(x: number, y: number, a: number[], b: number[]): number {
	const dx = b[0] - a[0],
		dy = b[1] - a[1],
		length = dx * dx + dy * dy;
	const t = length ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / length)) : 0;
	return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy);
}
/** Nearest stroke median across the whole glyph, with tolerance at component boundaries. */
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
