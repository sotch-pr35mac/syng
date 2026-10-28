import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { convertCharacter, validGeometry } from './prepare-character-breakdown.mjs';
const geometry = {
	strokes: ['M 0 0 L 10 10 Z', 'M 20 0 L 30 10 Z'],
	medians: [
		[
			[0, 0],
			[10, 10],
		],
		[
			[20, 0],
			[30, 10],
		],
	],
};
const report = () => ({
	reusedGraphics: 0,
	retainedGraphics: 0,
	disabledMappings: [],
	withoutHighlighting: 0,
});
test('source mapping is kept with its geometry, never applied to a different bundled glyph', () => {
	const changed = { ...geometry, strokes: ['M 1 1 L 10 10 Z', geometry.strokes[1]] };
	const row = convertCharacter(
		{
			char: '要',
			isVerified: true,
			hint: ' source text ',
			components: [
				{ character: '◎', type: ['iconic'] },
				{ character: '女', type: ['meaning'] },
			],
			images: [{ source: 'dong-chinese', data: geometry, fragments: [[0], [1]] }],
		},
		null,
		changed,
		report()
	);
	assert.equal(row.glyph.kind, 'inline');
	assert.equal(row.components[0].character, null);
	assert.deepEqual(row.components[1].strokes, [1]);
	assert.equal(row.formation, 'source text');
});
test('out of range and mismatched component mappings disable interaction without losing text', () => {
	for (const fragments of [[[0], [2]], [[0]]]) {
		const row = convertCharacter(
			{
				char: '启',
				hint: 'Preserved source note',
				components: [{ character: '户' }, { character: '口' }],
				images: [{ source: 'makemeahanzi', data: geometry, fragments }],
			},
			null,
			geometry,
			report()
		);
		assert.equal(row.formation, 'Preserved source note');
		assert.ok(row.components.every((c) => !c.strokes));
	}
	assert.equal(validGeometry({ ...geometry, medians: [[[0, NaN]]] }), false);
});
test('unverified, deleted, empty, and multi-role components retain their source distinctions', () => {
	const row = convertCharacter(
		{
			char: '字',
			components: [{ character: '子', type: ['sound', 'meaning', 'deleted'], hint: null }],
			images: null,
		},
		{ radical: '宀' },
		null,
		report()
	);
	assert.equal(row.verified, false);
	assert.deepEqual(row.components[0].roles, ['sound', 'meaning', 'deleted']);
	assert.equal(row.components[0].note, '');
	assert.equal(row.formation, '');
});
test('shipped corpus has valid geometry references, all roles, and exact eligibility', () => {
	const root = 'src/views/resources/character-breakdown';
	const index = JSON.parse(readFileSync(`${root}/index.json`));
	const radicals = JSON.parse(readFileSync(`${root}/radicals.json`));
	assert.equal(radicals._notice.license, 'LGPL-3.0-or-later');
	assert.equal(radicals.radicals['清'], '氵');
	const roles = new Set();
	let arphicCount = 0;
	let maximum = 0;
	for (const filename of readdirSync(`${root}/chars`)) {
		const row = JSON.parse(readFileSync(`${root}/chars/${filename}`));
		assert.equal('radical' in row, false);
		assert.ok(!(row.glyph?.kind === 'inline' && row.glyphSource === 'makemeahanzi'));
		assert.equal(
			index[row.character],
			Number(row.verified && !!(row.formation || row.components.length))
		);
		const glyph =
			row.glyph?.kind === 'resource'
				? JSON.parse(readFileSync(`src/views/${decodeURIComponent(row.glyph.path)}`))
				: row.glyph;
		if (
			row.glyph?.kind === 'resource' &&
			row.glyph.path.startsWith('resources/character-breakdown/arphic/')
		) {
			arphicCount++;
			assert.equal(glyph._notice.license, 'Arphic-Public-License');
			assert.match(glyph._notice.modified, /^\d{4}-\d{2}-\d{2}$/);
			assert.ok(glyph._notice.changes);
		}
		if (glyph) {
			assert.ok(validGeometry(glyph), row.character);
		}
		for (const part of row.components) {
			for (const role of part.roles) {
				roles.add(role);
			}
			for (const stroke of part.strokes ?? []) {
				assert.ok(glyph && stroke >= 0 && stroke < glyph.strokes.length, row.character);
			}
		}
		maximum = Math.max(maximum, row.components.length);
	}
	assert.equal(roles.size, 8);
	assert.equal(arphicCount, 20);
	assert.ok(maximum >= 5);
	const qing = JSON.parse(readFileSync(`${root}/chars/6e05.json`));
	assert.equal(qing.components[1].note, '');
	assert.equal(qing.components[1].character, '青');
	assert.equal('gloss' in qing, false);
});
