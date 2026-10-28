import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import {
	loadBreakdownGeometry,
	loadBreakdown,
	lookupCharacter,
	nearestComponent,
} from '@/utils/characterBreakdown.js';
import type { CharacterBreakdownRecord, CharacterGeometry } from '@/types/characterBreakdown.js';
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
beforeEach(() => vi.mocked(invoke).mockReset());
afterEach(() => vi.unstubAllGlobals());
it('joins separately licensed notes, radicals, and Arphic geometry for display', async () => {
	const record: CharacterBreakdownRecord = {
		character: '𠁁',
		verified: true,
		formation: 'Source note',
		components: [],
		glyph: { kind: 'resource', path: 'resources/character-breakdown/arphic/20041.json' },
	};
	const data: CharacterGeometry = { strokes: ['M 0 0'], medians: [[[0, 0]]] };
	const files = {
		'resources/character-breakdown/index.json': { '𠁁': 1 },
		'resources/character-breakdown/chars/20041.json': record,
		'resources/character-breakdown/radicals.json': { radicals: { '𠁁': '一' } },
		'resources/character-breakdown/arphic/20041.json': data,
	};
	const fetchMock = vi.fn(
		async (url: string) =>
			new Response(JSON.stringify(files[url]), {
				headers: { 'content-type': 'application/json' },
			})
	);
	vi.stubGlobal('fetch', fetchMock);
	const loaded = await loadBreakdown('𠁁');
	expect(loaded).toEqual({ ...record, radical: '一' });
	expect(await loadBreakdownGeometry(loaded)).toEqual(data);
	await loadBreakdown('𠁁');
	expect(fetchMock).toHaveBeenCalledTimes(4);
});
it('reports and caches a packaged graphics failure without repeating the request', async () => {
	const record: CharacterBreakdownRecord = {
		character: '要',
		verified: true,
		formation: '',
		components: [],
		glyph: { kind: 'resource', path: 'resources/hanzi-writer-data/data/%E8%A6%81.json' },
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
	await expect(loadBreakdownGeometry(record)).rejects.toThrow('Could not load character data');
	expect(fetchMock).toHaveBeenCalledTimes(1);
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
