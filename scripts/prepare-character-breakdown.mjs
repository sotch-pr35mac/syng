/** Convert pinned local source files into offline assets; acquisition runs during installation. */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
	readFileSync,
	writeFileSync,
	mkdirSync,
	existsSync,
	readdirSync,
	unlinkSync,
} from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SOURCES = {
	dong: {
		url: 'https://data.dong-chinese.com/dump/dictionary_char_2025-12-27.jsonl',
		sha256: '046249581c3414baa12b6eff4a8d3c31ef1be7f70634fe919dfa1c01e99ab3eb',
		license: 'CC-BY-SA-4.0',
	},
	radicals: {
		url: 'https://raw.githubusercontent.com/skishore/makemeahanzi/bddc96d41bef78427ed0e034e9f7e31d71fd1b92/dictionary.txt',
		revision: 'bddc96d41bef78427ed0e034e9f7e31d71fd1b92',
		sha256: '744bb05d5b0742e9ee35c37791f94d56a173349b3367569e7ca11e510364d203',
		license: 'LGPL-3.0-or-later',
	},
	graphics: {
		revision: 'ad1a9905cada18d07630acc27d438b070d753ec0',
		license: 'Arphic-Public-License',
	},
};
// Date of this adaptation/schema, not the local installation date: tagged builds stay reproducible.
const MODIFIED = '2026-10-27';
const ROLES = new Set([
	'meaning',
	'sound',
	'iconic',
	'remnant',
	'distinguishing',
	'unknown',
	'simplified',
	'deleted',
]);
const text = (value) => (typeof value === 'string' ? value.trim() : '');
const array = (value) => (Array.isArray(value) ? value : []);
export const characterKey = (char) => [...char].map((c) => c.codePointAt(0).toString(16)).join('-');
export function validGeometry(data) {
	return (
		Array.isArray(data?.strokes) &&
		data.strokes.length > 0 &&
		data.strokes.every(
			(p) => typeof p === 'string' && /^[MmLlHhVvCcSsQqTtAaZz\d\s.,+\-]+$/.test(p)
		) &&
		Array.isArray(data.medians) &&
		data.medians.length === data.strokes.length &&
		data.medians.every(
			(line) =>
				Array.isArray(line) &&
				line.length >= 2 &&
				line.every((p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite))
		)
	);
}
export function convertCharacter(d, radical, bundled, report) {
	const char = d.char ?? radical?.character;
	const components = array(d.components)
		.filter((p) => p && typeof p === 'object')
		.map((p) => ({
			character: p.character === '◎' ? null : text(p.character) || null,
			roles: array(p.type).filter((t) => ROLES.has(t)),
			note: text(p.hint),
			...(p.isGlyphChanged ? { changedForm: true } : {}),
			...(p.isOldPronunciation ? { historicalSound: true } : {}),
			...(p.isFromOriginalMeaning ? { originalMeaning: true } : {}),
		}));
	const record = {
		character: char,
		verified: d.isVerified === true,
		formation: text(d.hint),
		components,
		...(radical?.radical ? { radical: radical.radical } : {}),
		...(Number.isInteger(d.strokeCount) && d.strokeCount > 0
			? { strokeCount: d.strokeCount }
			: {}),
	};
	const images = array(d.images).filter(
		(im) => ['makemeahanzi', 'dong-chinese'].includes(im?.source) && validGeometry(im.data)
	);
	// Prefer a complete, validated mapping, then retain usable geometry without interaction.
	const mapped = (im) =>
		Array.isArray(im.fragments) &&
		im.fragments.length === components.length &&
		im.fragments.every(
			(f) =>
				Array.isArray(f) &&
				f.every((i) => Number.isInteger(i) && i >= 0 && i < im.data.strokes.length)
		);
	const im = images.find(mapped) ?? images[0];
	if (im) {
		const same =
			bundled &&
			JSON.stringify(bundled.strokes) === JSON.stringify(im.data.strokes) &&
			JSON.stringify(bundled.medians) === JSON.stringify(im.data.medians);
		record.glyph = same
			? { kind: 'bundled' }
			: { kind: 'inline', strokes: im.data.strokes, medians: im.data.medians };
		record.glyphSource = im.source;
		report[same ? 'reusedGraphics' : 'retainedGraphics']++;
		if (mapped(im)) {
			components.forEach((p, i) => {
				p.strokes = im.fragments[i];
			});
		} else if (components.length) {
			report.disabledMappings.push(char);
		}
	} else if (validGeometry(bundled)) {
		record.glyph = { kind: 'bundled' };
		record.glyphSource = 'makemeahanzi';
		report.reusedGraphics++;
	}
	if (!record.strokeCount && (im || bundled)) {
		record.strokeCount = (im?.data ?? bundled).strokes.length;
	}
	if (components.length && !components.some((p) => p.strokes?.length)) {
		report.withoutHighlighting++;
	}
	return record;
}
function readPinned(path, source) {
	const bytes = readFileSync(path);
	if (createHash('sha256').update(bytes).digest('hex') !== source.sha256) {
		throw new Error(`Source checksum mismatch: ${path}`);
	}
	return bytes
		.toString('utf8')
		.split('\n')
		.filter(Boolean)
		.map((line) => JSON.parse(line));
}
export function generate(dongPath, radicalPath, output, graphics) {
	const revision = execFileSync('git', ['-C', graphics, 'rev-parse', 'HEAD'], {
		encoding: 'utf8',
	}).trim();
	if (revision !== SOURCES.graphics.revision) {
		throw new Error(
			'Unexpected hanzi-writer-data revision. Restore the pinned submodule before generating.'
		);
	}
	if (!existsSync(join(graphics, '清.json'))) {
		throw new Error('Initialize the pinned hanzi-writer-data submodule first.');
	}
	const dong = readPinned(dongPath, SOURCES.dong),
		radicals = readPinned(radicalPath, SOURCES.radicals);
	const byChar = new Map(
		dong
			.filter((d) => typeof d.char === 'string' && [...d.char].length === 1)
			.map((d) => [d.char, d])
	);
	const radicalMap = new Map(radicals.map((d) => [d.character, d]));
	const chars = new Set([
		...radicalMap.keys(),
		...[...byChar]
			.filter(([, d]) => text(d.hint) || array(d.components).length)
			.map(([c]) => c),
	]);
	const report = {
		records: 0,
		verified: 0,
		autoOpen: 0,
		reusedGraphics: 0,
		retainedGraphics: 0,
		withoutHighlighting: 0,
		disabledMappings: [],
	};
	const index = {};
	mkdirSync(join(output, 'chars'), { recursive: true });
	mkdirSync(join(output, 'arphic'), { recursive: true });
	const expected = new Set();
	const expectedArphic = new Set();
	const radicalFields = {};
	for (const c of [...chars].sort((a, b) => a.codePointAt(0) - b.codePointAt(0))) {
		const path = join(graphics, `${c}.json`);
		const bundled = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null;
		const r = convertCharacter(byChar.get(c) ?? {}, radicalMap.get(c), bundled, report);
		const eligible = r.verified && !!(r.formation || r.components.length);
		index[c] = eligible ? 1 : 0;
		const filename = `${characterKey(c)}.json`;
		expected.add(filename);
		// Keep the LGPL fields and Arphic vectors independently licensed and reusable.
		// The application joins these resources only when displaying a character.
		if (r.radical) {
			radicalFields[c] = r.radical;
			delete r.radical;
		}
		if (r.glyph?.kind === 'inline' && r.glyphSource === 'makemeahanzi') {
			writeFileSync(
				join(output, 'arphic', filename),
				JSON.stringify({
					_notice: {
						license: SOURCES.graphics.license,
						copyright: 'Copyright (C) 1999 Arphic Technology Co., Ltd.',
						modifiedBy: 'Syng',
						modified: MODIFIED,
						changes:
							'Selected and repackaged Make Me a Hanzi vectors from the pinned Dong Chinese dump. Stroke paths and medians are unchanged.',
						source: SOURCES.dong.url,
						licenseFile: '../licenses/hanzi-writer-data-ArphicPublicLicense.txt',
					},
					strokes: r.glyph.strokes,
					medians: r.glyph.medians,
				}) + '\n'
			);
			expectedArphic.add(filename);
			r.glyph = { kind: 'arphic' };
		}
		writeFileSync(join(output, 'chars', filename), JSON.stringify(r) + '\n');
		report.records++;
		if (r.verified) report.verified++;
		if (eligible) report.autoOpen++;
	}
	for (const file of readdirSync(join(output, 'chars'))) {
		if (file.endsWith('.json') && !expected.has(file)) unlinkSync(join(output, 'chars', file));
	}
	for (const file of readdirSync(join(output, 'arphic'))) {
		if (file.endsWith('.json') && !expectedArphic.has(file))
			unlinkSync(join(output, 'arphic', file));
	}
	writeFileSync(
		join(output, 'radicals.json'),
		JSON.stringify({
			_notice: {
				license: SOURCES.radicals.license,
				modifiedBy: 'Syng',
				modified: MODIFIED,
				changes:
					'Selected character/radical pairs from Make Me a Hanzi dictionary.txt; field values are unchanged.',
				source: SOURCES.radicals.url,
				licenseFile: 'licenses/Make-Me-a-Hanzi-LGPL-3.0.txt',
			},
			radicals: radicalFields,
		}) + '\n'
	);
	writeFileSync(join(output, 'index.json'), JSON.stringify(index) + '\n');
	writeFileSync(
		join(output, 'manifest.json'),
		JSON.stringify(
			{
				version: 2,
				modified: MODIFIED,
				sources: SOURCES,
				licenses: {
					'chars/':
						'CC-BY-SA-4.0 for Dong Chinese content; bundled/Arphic glyph references contain no copied vectors.',
					'radicals.json': 'LGPL-3.0-or-later',
					'arphic/': 'Arphic-Public-License',
				},
				changes:
					'Selected fields; whitespace trimmed; no generated prose or gloss fallbacks. Exact matching bundled geometry reused; other source geometry retained. Invalid mappings disabled.',
				report,
			},
			null,
			2
		) + '\n'
	);
	return report;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const [dong, radicals] = process.argv.slice(2);
	if (!dong || !radicals)
		throw new Error(
			'Usage: node scripts/prepare-character-breakdown.mjs DONG_JSONL MMH_DICTIONARY'
		);
	console.log(
		generate(
			dong,
			radicals,
			resolve('src/views/resources/character-breakdown'),
			resolve('src/views/resources/hanzi-writer-data/data')
		)
	);
}
