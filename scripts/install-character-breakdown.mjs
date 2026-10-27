/** Prepare offline character assets during dependency installation (including make install). */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, renameSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SOURCES, generate } from './prepare-character-breakdown.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const cache = join(root, '.cache/character-breakdown');
const output = join(root, 'src/views/resources/character-breakdown');
const graphics = join(root, 'src/views/resources/hanzi-writer-data/data');
mkdirSync(cache, { recursive: true });

/** Cache verified source bytes so subsequent installs can prepare assets offline. */
async function sourceFile(name, source) {
	const path = join(cache, name);
	if (existsSync(path)) return path; // generate() verifies cached bytes before using them.
	console.log(`Downloading character source: ${source.url}`);
	const response = await fetch(source.url, { signal: AbortSignal.timeout(120_000) });
	if (!response.ok) throw new Error(`Character source download failed: HTTP ${response.status}`);
	const bytes = Buffer.from(await response.arrayBuffer());
	if (createHash('sha256').update(bytes).digest('hex') !== source.sha256) {
		throw new Error(`Character source checksum mismatch: ${source.url}`);
	}
	writeFileSync(`${path}.tmp`, bytes);
	renameSync(`${path}.tmp`, path);
	return path;
}

// make install initializes this already; npm ci on a fresh checkout needs it too.
if (!existsSync(join(graphics, '清.json'))) {
	execFileSync(
		'git',
		['submodule', 'update', '--init', '--', 'src/views/resources/hanzi-writer-data'],
		{
			cwd: root,
			stdio: 'inherit',
		}
	);
}
const dong = await sourceFile('dong.jsonl', SOURCES.dong);
const radicals = await sourceFile('radicals.jsonl', SOURCES.radicals);
const report = generate(dong, radicals, output, graphics);

// Package attribution from the same canonical texts used by Settings.
mkdirSync(join(output, 'licenses'), { recursive: true });
for (const name of [
	'Character-Breakdown-NOTICE.txt',
	'Dong-Chinese-NOTICE.txt',
	'Make-Me-a-Hanzi-Dictionary-NOTICE.txt',
	'Dong-Chinese-CC-BY-SA-4.0.txt',
	'Make-Me-a-Hanzi-LGPL-3.0.txt',
	'Syng-GPLv3.txt',
	'hanzi-writer-data-ArphicPublicLicense.txt',
]) {
	copyFileSync(join(root, 'src/native/resources/licenses', name), join(output, 'licenses', name));
}
console.log(`Prepared ${report.records} offline character breakdown records.`);
