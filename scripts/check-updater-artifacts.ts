import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { gunzipSync, inflateRawSync } from 'node:zlib';
import { pathToFileURL } from 'node:url';

export type BundleType = 'app' | 'appimage' | 'deb' | 'rpm' | 'msi' | 'nsis';

export const TARGET_BUNDLES: Record<string, readonly BundleType[]> = {
	'aarch64-apple-darwin': ['app'],
	'x86_64-apple-darwin': ['app'],
	'x86_64-unknown-linux-gnu': ['appimage', 'deb', 'rpm'],
	'aarch64-unknown-linux-gnu': ['appimage', 'deb', 'rpm'],
	'x86_64-pc-windows-msvc': ['msi', 'nsis'],
	'i686-pc-windows-msvc': ['msi', 'nsis'],
	'aarch64-pc-windows-msvc': ['nsis'],
};

const ARTIFACTS: Record<BundleType, { directory: string; suffix: string }> = {
	app: { directory: 'macos', suffix: '.app.tar.gz' },
	appimage: { directory: 'appimage', suffix: '.AppImage' },
	deb: { directory: 'deb', suffix: '.deb' },
	rpm: { directory: 'rpm', suffix: '.rpm' },
	msi: { directory: 'msi', suffix: '.msi' },
	nsis: { directory: 'nsis', suffix: '-setup.exe' },
};

function decodePacket(encoded: string, signature: boolean): Buffer {
	const lines = Buffer.from(encoded.trim(), 'base64').toString('utf8').trim().split(/\r?\n/);
	const packet = Buffer.from(lines[1] ?? '', 'base64');
	if (
		!lines[0]?.startsWith('untrusted comment:') ||
		packet.length !== (signature ? 74 : 42) ||
		!['Ed', 'ED'].includes(packet.subarray(0, 2).toString('ascii')) ||
		(signature &&
			(!lines[2]?.startsWith('trusted comment:') ||
				Buffer.from(lines[3] ?? '', 'base64').length !== 64))
	) {
		throw new Error(`Invalid Tauri ${signature ? 'signature' : 'public key'} encoding`);
	}
	return packet;
}

function checkSignature(path: string, publicKey: Buffer): void {
	const packet = decodePacket(readFileSync(`${path}.sig`, 'utf8'), true);
	if (!packet.subarray(2, 10).equals(publicKey.subarray(2, 10))) {
		throw new Error(`Updater signing key does not match the configured public key: ${path}`);
	}
}

function singleArtifact(directory: string, suffix: string): string {
	const matches = readdirSync(directory, { withFileTypes: true })
		.filter((entry) => entry.isFile() && entry.name.endsWith(suffix))
		.map((entry) => join(directory, entry.name));
	if (matches.length !== 1 || statSync(matches[0]).size === 0) {
		throw new Error(`Expected one nonempty ${suffix} artifact in ${directory}`);
	}
	return matches[0];
}

function textField(bytes: Buffer): string {
	return bytes.toString('utf8').replace(/\0.*$/s, '');
}

// Tauri wraps one completed, dense AppImage in a tar archive. Accept the plain
// regular-file archive emitted by tar::Builder::append_file; fail closed on
// sparse files, extension records, or extra files instead of guessing payloads.
function tarPayload(archive: Buffer, expectedName: string): Buffer {
	const contents = gunzipSync(archive);
	let payload: Buffer | undefined;
	for (let offset = 0; offset + 512 <= contents.length;) {
		const header = contents.subarray(offset, offset + 512);
		if (header.every((byte) => byte === 0)) break;
		const size = Number.parseInt(textField(header.subarray(124, 136)).trim(), 8);
		if (!Number.isSafeInteger(size) || size < 0 || offset + 512 + size > contents.length) {
			throw new Error('Invalid compatibility tar archive');
		}
		const entryType = header[156];
		if (entryType === 0 || entryType === 48) {
			const name = textField(header.subarray(0, 100));
			const prefix = textField(header.subarray(345, 500));
			if (payload || prefix || name !== expectedName) {
				throw new Error('Compatibility tar must contain only the expected AppImage');
			}
			payload = contents.subarray(offset + 512, offset + 512 + size);
		} else {
			throw new Error('Unexpected entry in compatibility tar archive');
		}
		offset += 512 + Math.ceil(size / 512) * 512;
	}
	if (!payload) throw new Error('Missing AppImage in compatibility tar archive');
	return payload;
}

// Read the central directory, which handles ZIP data descriptors correctly.
// Tauri emits a single stored installer; deflate is accepted for existing ZIPs.
function zipPayload(archive: Buffer, expectedName: string): Buffer {
	let endOffset = -1;
	for (
		let offset = archive.length - 22;
		offset >= Math.max(0, archive.length - 65_557);
		offset--
	) {
		if (
			archive.readUInt32LE(offset) === 0x06054b50 &&
			offset + 22 + archive.readUInt16LE(offset + 20) === archive.length
		) {
			endOffset = offset;
			break;
		}
	}
	if (endOffset < 0 || archive.readUInt16LE(endOffset + 10) !== 1) {
		throw new Error('Compatibility ZIP must contain exactly one installer');
	}
	const centralOffset = archive.readUInt32LE(endOffset + 16);
	if (centralOffset + 46 > endOffset || archive.readUInt32LE(centralOffset) !== 0x02014b50) {
		throw new Error('Invalid compatibility ZIP directory');
	}
	const flags = archive.readUInt16LE(centralOffset + 8);
	const method = archive.readUInt16LE(centralOffset + 10);
	const compressedSize = archive.readUInt32LE(centralOffset + 20);
	const size = archive.readUInt32LE(centralOffset + 24);
	const nameLength = archive.readUInt16LE(centralOffset + 28);
	const name = archive
		.subarray(centralOffset + 46, centralOffset + 46 + nameLength)
		.toString('utf8');
	const localOffset = archive.readUInt32LE(centralOffset + 42);
	if (
		flags & 1 ||
		name !== expectedName ||
		localOffset + 30 > centralOffset ||
		archive.readUInt32LE(localOffset) !== 0x04034b50
	) {
		throw new Error('Unexpected installer in compatibility ZIP');
	}
	const payloadOffset =
		localOffset +
		30 +
		archive.readUInt16LE(localOffset + 26) +
		archive.readUInt16LE(localOffset + 28);
	if (payloadOffset + compressedSize > centralOffset)
		throw new Error('Truncated compatibility ZIP');
	const compressed = archive.subarray(payloadOffset, payloadOffset + compressedSize);
	const payload =
		method === 0 ? compressed : method === 8 ? inflateRawSync(compressed) : undefined;
	if (!payload || payload.length !== size)
		throw new Error('Unsupported compatibility ZIP encoding');
	return payload;
}

function checkArchive(archivePath: string, nativePath: string): void {
	const archive = readFileSync(archivePath);
	const payload = archivePath.endsWith('.tar.gz')
		? tarPayload(archive, basename(nativePath))
		: zipPayload(archive, basename(nativePath));
	const digest = (contents: Buffer) => createHash('sha256').update(contents).digest('hex');
	if (digest(payload) !== digest(readFileSync(nativePath))) {
		throw new Error(`Compatibility archive contains different package bytes: ${archivePath}`);
	}
}

export function validateUpdaterArtifacts(options: {
	bundleDirectory: string;
	target: string;
	publicKey: string;
	bridge: boolean;
}): string[] {
	const bundles = TARGET_BUNDLES[options.target];
	if (!bundles) throw new Error(`Unsupported release target: ${options.target}`);
	const publicKey = decodePacket(options.publicKey, false);
	const checked: string[] = [];
	for (const bundle of bundles) {
		const artifact = ARTIFACTS[bundle];
		const path = singleArtifact(
			join(options.bundleDirectory, artifact.directory),
			artifact.suffix
		);
		checkSignature(path, publicKey);
		checked.push(path);
		if (options.bridge && ['appimage', 'msi', 'nsis'].includes(bundle)) {
			const archive =
				bundle === 'appimage'
					? `${path}.tar.gz`
					: bundle === 'msi'
						? `${path}.zip`
						: path.replace(/\.exe$/, '.nsis.zip');
			checkSignature(archive, publicKey);
			checkArchive(archive, path);
			checked.push(archive);
		}
	}
	return checked;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
	const [target, bundleDirectory] = process.argv.slice(2);
	if (!target || !bundleDirectory) {
		throw new Error('Usage: node scripts/check-updater-artifacts.ts TARGET BUNDLE_DIRECTORY');
	}
	const config = JSON.parse(readFileSync('src/native/tauri.conf.json', 'utf8'));
	const checked = validateUpdaterArtifacts({
		target,
		bundleDirectory,
		publicKey: config.plugins.updater.pubkey,
		bridge: config.version === '2.5.2',
	});
	console.log(
		`Checked ${checked.length} updater artifacts: signature encoding/key IDs and compatibility archive bytes.`
	);
	console.log(
		'Cryptographic signature acceptance and packaged upgrades remain release promotion gates.'
	);
}
