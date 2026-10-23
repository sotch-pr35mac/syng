import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	createReleaseHistoryStorage,
	compareReleaseVersions,
	emptyReleaseHistory,
	isReleaseVersion,
	nextReleaseHistory,
	readReleaseHistory,
	releasesInRange,
	RELEASES,
} from '@/utils/whatsNew.js';
import type { ReleaseHistory, ReleaseMetadata } from '@/types/whatsNew.js';
import { readFileSync } from 'node:fs';

const releases: ReleaseMetadata[] = [
	{ version: '2.6.0', date: '', announce: true },
	{ version: '2.6.1', date: '', announce: false },
	{ version: '2.7.0', date: '', announce: true },
];
const existing = (version: string): ReleaseHistory => ({
	lastOpenedVersion: version,
	handledThroughVersion: version,
	pending: null,
});

it('ships an explicit presentation policy for the installed release', () => {
	const packageInfo = JSON.parse(readFileSync('package.json', 'utf8'));
	expect(RELEASES.find((release) => release.version === packageInfo.version)).toMatchObject({
		announce: expect.any(Boolean),
	});
});

describe('version precedence', () => {
	it.each([
		['2.9.0', '2.10.0', -1],
		['2.6.0', '2.6.0+build.2', 0],
		['2.6.0-beta.9', '2.6.0-beta.10', -1],
		['2.6.0-1', '2.6.0-alpha', -1],
		['2.6.0-beta', '2.6.0', -1],
		['2.6.0', '2.5.3', 1],
		['2.6.0-alpha', '2.6.0-alpha.1', -1],
	])('compares %s and %s', (left, right, sign) => {
		expect(Math.sign(compareReleaseVersions(left, right))).toBe(sign);
	});
	it.each(['', '2.6', '2.06.0', '2.6.0-01', 'hello', null, {}])('rejects %s', (version) => {
		expect(isReleaseVersion(version)).toBe(false);
	});
});

it('permanently suppresses the installed version for a new profile', () => {
	const first = nextReleaseHistory(emptyReleaseHistory(), '2.6.0', true, releases);
	expect(first).toEqual(existing('2.6.0'));
	expect(nextReleaseHistory(first, '2.6.0', false, releases).pending).toBeNull();
	expect(nextReleaseHistory(first, '2.7.0', false, releases).pending).toEqual({
		from: '2.6.0',
		to: '2.7.0',
	});
});

it('suppresses another update while first-time setup remains incomplete', () => {
	expect(nextReleaseHistory(existing('2.6.0'), '2.7.0', true, releases)).toEqual(
		existing('2.7.0')
	);
});

it('shows only current notes for an established profile without history', () => {
	const history = nextReleaseHistory(emptyReleaseHistory(), '2.7.0', false, releases);
	expect(releasesInRange(releases, history.pending!).map((release) => release.version)).toEqual([
		'2.7.0',
	]);
});

it('selects cumulative notes newest first, including intervening maintenance notes', () => {
	const history = nextReleaseHistory(existing('2.5.3'), '2.7.0', false, releases);
	expect(releasesInRange(releases, history.pending!).map((release) => release.version)).toEqual([
		'2.7.0',
		'2.6.1',
		'2.6.0',
	]);
});

it('does not announce a maintenance-only update', () => {
	expect(nextReleaseHistory(existing('2.6.0'), '2.6.1', false, releases)).toEqual(
		existing('2.6.1')
	);
});

it('keeps pending notes through restarts and a later maintenance update', () => {
	const pending = nextReleaseHistory(existing('2.5.3'), '2.6.0', false, releases);
	const restart = nextReleaseHistory(pending, '2.6.0', false, releases);
	expect(restart.pending).toEqual(pending.pending);
	expect(nextReleaseHistory(restart, '2.6.1', false, releases).pending).toEqual({
		from: '2.5.3',
		to: '2.6.1',
	});
});

it('retains the first known release when an unknown-origin upgrade remains pending', () => {
	const pending = nextReleaseHistory(emptyReleaseHistory(), '2.6.0', false, releases);
	const next = nextReleaseHistory(pending, '2.6.1', false, releases);
	expect(releasesInRange(releases, next.pending!).map((release) => release.version)).toEqual([
		'2.6.1',
		'2.6.0',
	]);
});

it('preserves handled and pending high-water marks across downgrades', () => {
	const downgrade = nextReleaseHistory(existing('2.7.0'), '2.6.0', false, releases);
	expect(downgrade.handledThroughVersion).toBe('2.7.0');
	expect(nextReleaseHistory(downgrade, '2.7.0', false, releases).pending).toBeNull();
	const pending = nextReleaseHistory(existing('2.5.3'), '2.7.0', false, releases);
	expect(nextReleaseHistory(pending, '2.6.0', false, releases).pending).toEqual(pending.pending);
});

it('safely handles missing and malformed saved fields', () => {
	expect(readReleaseHistory(undefined)).toEqual(emptyReleaseHistory());
	expect(readReleaseHistory({ pending: { from: 'banana', to: '2.6.0' } }).pending).toBeNull();
});

describe('installation-local history storage', () => {
	const historyId = '_local/syng-release-history';
	let documents: Map<string, Record<string, unknown>>;
	let getDocument: ReturnType<typeof vi.fn>;
	let putDocument: ReturnType<typeof vi.fn>;
	let storage: ReturnType<typeof createReleaseHistoryStorage>;

	beforeEach(() => {
		documents = new Map();
		getDocument = vi.fn(async (identifier: string) => {
			if (!documents.has(identifier)) {
				throw { status: 404, name: 'not_found' };
			}
			return structuredClone(documents.get(identifier));
		});
		putDocument = vi.fn(async (document: Record<string, unknown>) => {
			documents.set(document._id as string, structuredClone(document));
			return { ok: true };
		});
		vi.stubGlobal(
			'PouchDB',
			class {
				get = getDocument;
				put = putDocument;
			}
		);
		storage = createReleaseHistoryStorage('config');
	});
	afterEach(() => vi.unstubAllGlobals());

	it('preserves legacy history while moving subsequent writes out of preferences', async () => {
		const legacy = { _id: 'config', whatsNew: { value: existing('2.5.3') } };
		documents.set('config', legacy);
		expect(await storage.load()).toEqual(existing('2.5.3'));
		const pending = nextReleaseHistory(await storage.load(), '2.6.0', false);
		await storage.save(pending);
		expect(documents.get('config')).toEqual(legacy);
		expect(putDocument).toHaveBeenCalledExactlyOnceWith({ _id: historyId, history: pending });
		expect(await createReleaseHistoryStorage('config').load()).toEqual(pending);
	});

	it('prefers even empty local history to stale legacy preferences', async () => {
		documents.set('config', { _id: 'config', whatsNew: { value: existing('2.5.3') } });
		await storage.save(emptyReleaseHistory());
		expect(await storage.load()).toEqual(emptyReleaseHistory());
	});

	it('starts with empty history when neither document exists', async () => {
		expect(await storage.load()).toEqual(emptyReleaseHistory());
		expect(putDocument).not.toHaveBeenCalled();
	});

	it('does not mistake a failed read for missing history or overwrite the existing record', async () => {
		const failure = new Error('Storage unavailable');
		getDocument.mockRejectedValue(failure);
		await expect(storage.load()).rejects.toBe(failure);
		await expect(storage.save(existing('2.6.0'))).rejects.toBe(failure);
		expect(putDocument).not.toHaveBeenCalled();
	});

	it('retains pending notes after failed or unconfirmed saves and recovers the write queue', async () => {
		const pending = nextReleaseHistory(existing('2.5.3'), '2.6.0', false);
		await storage.save(pending);
		const failure = new Error('Disk full');
		putDocument.mockRejectedValueOnce(failure);
		await expect(storage.save(existing('2.6.0'))).rejects.toBe(failure);
		expect(await storage.load()).toEqual(pending);
		putDocument.mockResolvedValueOnce({ ok: false });
		await expect(storage.save(existing('2.6.0'))).rejects.toThrow('did not confirm');
		expect(await storage.load()).toEqual(pending);
		await storage.save(existing('2.6.0'));
		expect(await storage.load()).toEqual(existing('2.6.0'));
	});

	it('refreshes the local revision for one conflict retry and propagates a second failure', async () => {
		documents.set(historyId, { _id: historyId, _rev: '0-1', history: existing('2.5.3') });
		putDocument.mockImplementationOnce(async () => {
			documents.set(historyId, { _id: historyId, _rev: '0-2', history: existing('2.5.3') });
			throw { status: 409 };
		});
		await storage.save(existing('2.6.0'));
		expect(putDocument.mock.calls[1][0]._rev).toBe('0-2');
		putDocument
			.mockRejectedValueOnce({ status: 409 })
			.mockRejectedValueOnce(new Error('Retry failed'));
		await expect(storage.save(existing('2.7.0'))).rejects.toThrow('Retry failed');
		expect(await storage.load()).toEqual(existing('2.6.0'));
	});

	it('serializes writes and captures each requested history before it can be mutated', async () => {
		let finish!: () => void;
		putDocument.mockImplementationOnce(async (document) => {
			await new Promise<void>((resolve) => {
				finish = resolve;
			});
			documents.set(historyId, structuredClone(document));
			return { ok: true };
		});
		const first = storage.save(existing('2.5.3'));
		const next = existing('2.6.0');
		const second = storage.save(next);
		next.handledThroughVersion = '9.0.0';
		await vi.waitFor(() => expect(putDocument).toHaveBeenCalledTimes(1));
		finish();
		await Promise.all([first, second]);
		expect(await storage.load()).toEqual(existing('2.6.0'));
	});

	it('uses the app-services configuration database, including development isolation', async () => {
		const opened: string[] = [];
		vi.stubGlobal(
			'PouchDB',
			class {
				constructor(name: string) {
					opened.push(name);
				}
				get = getDocument;
				put = putDocument;
			}
		);
		const { createAppServices, getReleaseHistoryStorage, resetAppServicesForTest } =
			await import('@/utils/appServices.js');
		for (const name of ['config', 'development_config']) {
			createAppServices(name, 'lists', 'bookmarks', 'reader');
			await getReleaseHistoryStorage().load();
		}
		expect(opened.filter((name) => name.endsWith('config'))).toEqual([
			'config',
			'development_config',
		]);
		resetAppServicesForTest();
	});
});
