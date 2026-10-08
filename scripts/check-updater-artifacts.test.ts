import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { gzipSync } from 'node:zlib';
import { test } from 'node:test';
import { TARGET_BUNDLES, validateUpdaterArtifacts } from './check-updater-artifacts.ts';
import type { BundleType } from './check-updater-artifacts.ts';

const keyId = Buffer.from('12345678');
const publicKey = Buffer.from(
	`untrusted comment: test key\n${Buffer.concat([
		Buffer.from('Ed'),
		keyId,
		Buffer.alloc(32),
	]).toString('base64')}\n`
).toString('base64');

// These fixture signatures only test encoding/key IDs, not cryptographic validity.
function signature(identifier = keyId): string {
	return Buffer.from(
		`untrusted comment: test signature\n${Buffer.concat([
			Buffer.from('ED'),
			identifier,
			Buffer.alloc(64),
		]).toString(
			'base64'
		)}\ntrusted comment: test fixture\n${Buffer.alloc(64).toString('base64')}\n`
	).toString('base64');
}

function tar(name: string, payload: Buffer): Buffer {
	const header = Buffer.alloc(512);
	header.write(name, 0);
	header.write(`${payload.length.toString(8).padStart(11, '0')}\0`, 124);
	header[156] = 48;
	return gzipSync(
		Buffer.concat([
			header,
			payload,
			Buffer.alloc(((512 - (payload.length % 512)) % 512) + 1024),
		])
	);
}

function zip(name: string, payload: Buffer): Buffer {
	const filename = Buffer.from(name);
	const local = Buffer.alloc(30);
	local.writeUInt32LE(0x04034b50, 0);
	local.writeUInt32LE(payload.length, 18);
	local.writeUInt32LE(payload.length, 22);
	local.writeUInt16LE(filename.length, 26);
	const central = Buffer.alloc(46);
	central.writeUInt32LE(0x02014b50, 0);
	central.writeUInt32LE(payload.length, 20);
	central.writeUInt32LE(payload.length, 24);
	central.writeUInt16LE(filename.length, 28);
	const end = Buffer.alloc(22);
	end.writeUInt32LE(0x06054b50, 0);
	end.writeUInt16LE(1, 8);
	end.writeUInt16LE(1, 10);
	end.writeUInt32LE(central.length + filename.length, 12);
	end.writeUInt32LE(local.length + filename.length + payload.length, 16);
	return Buffer.concat([local, filename, payload, central, filename, end]);
}

const fixturePaths: Record<BundleType, string> = {
	app: 'macos/Syng.app.tar.gz',
	appimage: 'appimage/Syng_2.5.2_amd64.AppImage',
	deb: 'deb/Syng_2.5.2_amd64.deb',
	rpm: 'rpm/Syng-2.5.2-1.x86_64.rpm',
	msi: 'msi/Syng_2.5.2_x64_en-US.msi',
	nsis: 'nsis/Syng_2.5.2_x64-setup.exe',
};

function fixture(target: string, bridge = true): { directory: string; paths: string[] } {
	const directory = mkdtempSync(join(tmpdir(), 'syng-updater-test-'));
	const paths: string[] = [];
	for (const bundle of TARGET_BUNDLES[target]) {
		const relativePath = fixturePaths[bundle];
		const nativePath = join(directory, relativePath);
		mkdirSync(join(directory, relativePath.split('/')[0]), { recursive: true });
		const payload = Buffer.from(`fixture ${target} ${bundle}`);
		writeFileSync(nativePath, payload);
		writeFileSync(`${nativePath}.sig`, signature());
		paths.push(nativePath);
		if (bridge && ['appimage', 'msi', 'nsis'].includes(bundle)) {
			const filename = relativePath.split('/')[1];
			const archivePath =
				bundle === 'appimage'
					? `${nativePath}.tar.gz`
					: bundle === 'msi'
						? `${nativePath}.zip`
						: nativePath.replace(/\.exe$/, '.nsis.zip');
			writeFileSync(
				archivePath,
				bundle === 'appimage' ? tar(filename, payload) : zip(filename, payload)
			);
			writeFileSync(`${archivePath}.sig`, signature());
			paths.push(archivePath);
		}
	}
	return { directory, paths };
}

function validate(directory: string, target = 'x86_64-unknown-linux-gnu', bridge = true): string[] {
	return validateUpdaterArtifacts({ bundleDirectory: directory, target, bridge, publicKey });
}

test('validates all thirteen native combinations and their bridge archives', () => {
	assert.equal(Object.values(TARGET_BUNDLES).flat().length, 13);
	for (const target of Object.keys(TARGET_BUNDLES)) {
		const { directory, paths } = fixture(target);
		try {
			assert.deepEqual(validate(directory, target).sort(), paths.sort());
		} finally {
			rmSync(directory, { recursive: true, force: true });
		}
	}
});

test('later native-only releases do not require bridge archives', () => {
	const target = 'x86_64-pc-windows-msvc';
	const { directory } = fixture(target, false);
	try {
		assert.equal(validate(directory, target, false).length, 2);
		assert.throws(() => validate(directory, target, true), /ENOENT/);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test('requires every package and its own matching signature file', () => {
	const { directory } = fixture('x86_64-unknown-linux-gnu');
	try {
		const path = join(directory, fixturePaths.deb);
		rmSync(`${path}.sig`);
		assert.throws(() => validate(directory), /ENOENT/);
		writeFileSync(`${path}.sig`, signature());
		rmSync(path);
		assert.throws(() => validate(directory), /Expected one nonempty/);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test('rejects malformed signatures and a signing key mismatch', () => {
	const { directory } = fixture('x86_64-unknown-linux-gnu');
	try {
		const path = `${join(directory, fixturePaths.rpm)}.sig`;
		writeFileSync(path, '');
		assert.throws(() => validate(directory), /Invalid Tauri signature/);
		writeFileSync(path, signature(Buffer.from('87654321')));
		assert.throws(() => validate(directory), /signing key does not match/);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test('rejects an AppImage archive containing a different binary or filename', () => {
	const { directory } = fixture('x86_64-unknown-linux-gnu');
	try {
		const path = join(directory, fixturePaths.appimage);
		const filename = fixturePaths.appimage.split('/')[1];
		writeFileSync(`${path}.tar.gz`, tar(filename, Buffer.from('different build')));
		assert.throws(() => validate(directory), /different package bytes/);
		writeFileSync(`${path}.tar.gz`, tar('different.AppImage', readFileSync(path)));
		assert.throws(() => validate(directory), /expected AppImage/);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test('rejects a Windows archive containing a different installer or filename', () => {
	const target = 'aarch64-pc-windows-msvc';
	const { directory } = fixture(target);
	try {
		const path = join(directory, fixturePaths.nsis);
		const archivePath = path.replace(/\.exe$/, '.nsis.zip');
		writeFileSync(
			archivePath,
			zip(fixturePaths.nsis.split('/')[1], Buffer.from('different build'))
		);
		assert.throws(() => validate(directory, target), /different package bytes/);
		writeFileSync(archivePath, zip('unexpected-setup.exe', readFileSync(path)));
		assert.throws(() => validate(directory, target), /Unexpected installer/);
		writeFileSync(archivePath, Buffer.from('truncated'));
		assert.throws(() => validate(directory, target), /exactly one installer/);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test('rejects ambiguous stale packages and unknown targets', () => {
	const { directory } = fixture('x86_64-unknown-linux-gnu');
	try {
		writeFileSync(join(directory, 'deb/stale.deb'), 'old build');
		assert.throws(() => validate(directory), /Expected one nonempty/);
		assert.throws(() => validate(directory, 'unknown-target'), /Unsupported release target/);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});
