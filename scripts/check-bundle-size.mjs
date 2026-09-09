import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

const BUILD_DIRECTORY = 'src/views/templates/build';
const ENTRY_FILE = join(BUILD_DIRECTORY, 'bundle.js');

// Keep enough room for routine feature work while preventing another monolithic-entry regression.
// Gzip totals are useful for web builds; raw sizes matter to Tauri because they also affect parsing.
const BUDGETS = {
	entryBytes: 200 * 1024,
	initialShellBytes: 275 * 1024,
	largestChunkBytes: 200 * 1024,
	totalBytes: 650 * 1024,
	totalGzipBytes: 230 * 1024,
};

function javascriptFiles(directory) {
	return readdirSync(directory).flatMap((name) => {
		const path = join(directory, name);
		return statSync(path).isDirectory()
			? javascriptFiles(path)
			: path.endsWith('.js')
				? [path]
				: [];
	});
}

function kibibytes(bytes) {
	return `${(bytes / 1024).toFixed(1)} KiB`;
}

function result(label, actual, budget) {
	const passed = actual <= budget;
	console.log(
		`${passed ? 'PASS' : 'FAIL'} ${label}: ${kibibytes(actual)} / ${kibibytes(budget)}`
	);
	return passed;
}

if (!existsSync(ENTRY_FILE)) {
	console.error(`Missing ${ENTRY_FILE}. Run the production build before checking its size.`);
	process.exit(1);
}

const chunks = javascriptFiles(BUILD_DIRECTORY).map((path) => {
	const contents = readFileSync(path);
	return {
		path,
		bytes: contents.byteLength,
		gzipBytes: gzipSync(contents).byteLength,
	};
});
const entry = chunks.find(({ path }) => path === ENTRY_FILE);
const chunksByPath = new Map(chunks.map((chunk) => [resolve(chunk.path), chunk]));

function staticImports(path) {
	const source = readFileSync(path, 'utf8');
	const specifiers = [
		...source.matchAll(/\bfrom\s*["']([^"']+\.js)["']/g),
		...source.matchAll(/\bimport\s*["']([^"']+\.js)["']/g),
	].map((match) => match[1]);
	return specifiers
		.filter((specifier) => specifier.startsWith('.'))
		.map((specifier) => resolve(dirname(path), specifier));
}

function dependencyGraphBytes(paths, visited = new Set()) {
	for (const path of paths) {
		if (visited.has(path)) {
			continue;
		}
		visited.add(path);
		dependencyGraphBytes(staticImports(path), visited);
	}
	return [...visited].reduce((total, path) => total + (chunksByPath.get(path)?.bytes ?? 0), 0);
}

const shellChunks = chunks.filter(({ path }) => /^(?:Mobile)?App-[\w-]+\.js$/.test(basename(path)));
if (!entry) {
	console.error('Could not identify the bootstrap chunk.');
	process.exit(1);
}
const initialShellBytes = shellChunks.length
	? Math.max(
			...shellChunks.map(({ path }) =>
				dependencyGraphBytes([resolve(ENTRY_FILE), resolve(path)])
			)
		)
	: dependencyGraphBytes([resolve(ENTRY_FILE)]);
const largest = chunks.reduce((current, chunk) =>
	chunk.bytes > current.bytes ? chunk : current
);
const totalBytes = chunks.reduce((total, chunk) => total + chunk.bytes, 0);
const totalGzipBytes = chunks.reduce((total, chunk) => total + chunk.gzipBytes, 0);

console.log(`JavaScript bundle budget (${chunks.length} chunks)`);
const checks = [
	result('bootstrap chunk', entry.bytes, BUDGETS.entryBytes),
	result('largest initial shell graph', initialShellBytes, BUDGETS.initialShellBytes),
	result(
		`largest chunk (${basename(largest.path)})`,
		largest.bytes,
		BUDGETS.largestChunkBytes
	),
	result('all chunks', totalBytes, BUDGETS.totalBytes),
	result('all chunks, gzip', totalGzipBytes, BUDGETS.totalGzipBytes),
];

if (checks.includes(false)) {
	console.error(
		`Bundle size exceeded its budget. Inspect ${relative('.', BUILD_DIRECTORY)} before raising a limit.`
	);
	process.exit(1);
}
