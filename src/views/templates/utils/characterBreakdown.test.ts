import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import {
	loadBreakdownGeometry,
	lookupCharacter,
	nearestComponent,
} from '@/utils/characterBreakdown.js';
import type { CharacterBreakdownRecord, CharacterGeometry } from '@/types/characterBreakdown.js';
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
beforeEach(() => vi.mocked(invoke).mockReset());
afterEach(() => vi.unstubAllGlobals());
it('reports HTML asset fallbacks with the path and retries failed graphics requests', async () => {
	const record: CharacterBreakdownRecord = {
		character: '要',
		verified: true,
		formation: '',
		components: [],
		glyph: { kind: 'bundled' },
	};
	const data: CharacterGeometry = { strokes: ['M 0 0'], medians: [[[0, 0]]] };
	const fetchMock = vi
		.fn()
		.mockResolvedValueOnce(
			new Response('<!doctype html>', {
				headers: { 'content-type': 'text/html' },
			})
		)
		.mockResolvedValueOnce(
			new Response(JSON.stringify(data), {
				headers: { 'content-type': 'application/json' },
			})
		);
	vi.stubGlobal('fetch', fetchMock);
	await expect(loadBreakdownGeometry(record)).rejects.toMatchObject({
		message: 'Could not load character data: resources/hanzi-writer-data/data/%E8%A6%81.json',
		cause: { message: 'Received HTML instead of character JSON' },
	});
	expect(await loadBreakdownGeometry(record)).toEqual(data);
	expect(fetchMock).toHaveBeenCalledTimes(2);
});
describe('component hit regions', () => {
	const geometry: CharacterGeometry = {
		strokes: ['', ''],
		medians: [
			[
				[100, 100],
				[100, 800],
			],
			[
				[800, 100],
				[800, 800],
			],
		],
	};
	const record = { components: [{ strokes: [0] }, { strokes: [1] }] } as CharacterBreakdownRecord;
	it('selects components in whitespace, with boundary tolerance', () => {
		expect(nearestComponent(record, geometry, 240, 400, null)).toBe(0);
		expect(nearestComponent(record, geometry, 700, 400, null)).toBe(1);
		expect(nearestComponent(record, geometry, 455, 400, 0)).toBe(0);
		expect(nearestComponent(record, geometry, 500, 400, 0)).toBe(1);
	});
	it('leaves unmapped parts noninteractive', () => {
		expect(
			nearestComponent(
				{ components: [{ strokes: [] }] } as CharacterBreakdownRecord,
				geometry,
				100,
				100,
				null
			)
		).toBeNull();
	});
});
it('does not turn a prefix match into a link for a missing radical', async () => {
	vi.mocked(invoke).mockResolvedValue([{ simplified: '覀字', traditional: '覀字' }]);
	expect(await lookupCharacter('覀')).toEqual([]);
});
it('keeps all exact senses but excludes compounds', async () => {
	const rows = [
		{ simplified: '青', traditional: '青' },
		{ simplified: '青', traditional: '青' },
		{ simplified: '青年', traditional: '青年' },
	];
	vi.mocked(invoke).mockResolvedValue(rows);
	expect(await lookupCharacter('青')).toEqual(rows.slice(0, 2));
});
