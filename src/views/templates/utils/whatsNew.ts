/**
 * Release announcement metadata, version/range rules, and installation-local history storage.
 * Startup uses this small module; detailed copy and interactive controls load with the page.
 * History advances independently from presentation so failed announcements remain pending.
 */
import type { ReleaseHistory, ReleaseMetadata, ReleaseRange } from '@/types/whatsNew.js';

// Keep startup metadata small. Detailed, interactive notes load with the page.
export const RELEASES: ReleaseMetadata[] = [
	{ version: '2.6.0', date: '2026-10-20', announce: true },
];

/** An installation with no known version or announcement history. */
export const emptyReleaseHistory = (): ReleaseHistory => ({
	lastOpenedVersion: null,
	handledThroughVersion: null,
	pending: null,
});

const VERSION =
	/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

/** Validate persisted/native versions before using the comparison helpers. */
export function isReleaseVersion(value: unknown): value is string {
	if (typeof value !== 'string' || !VERSION.test(value)) {
		return false;
	}
	const prerelease = value.match(VERSION)![4];
	return !prerelease?.split('.').some((part) => /^\d+$/.test(part) && /^0\d/.test(part));
}

/** Compare numeric identifiers without losing precision on large version components. */
function comparePart(left: string, right: string): number {
	if (/^\d+$/.test(left) && /^\d+$/.test(right)) {
		return left.length - right.length || (left < right ? -1 : left > right ? 1 : 0);
	}
	return left < right ? -1 : left > right ? 1 : 0;
}

/** Compare validated SemVer versions, including prereleases; ignore build metadata. */
export function compareReleaseVersions(left: string, right: string): number {
	const leftParts = left.match(VERSION)!;
	const rightParts = right.match(VERSION)!;
	const coreParts = 3;
	for (let index = 1; index <= coreParts; index += 1) {
		const comparison = comparePart(leftParts[index], rightParts[index]);
		if (comparison) {
			return comparison;
		}
	}
	if (!leftParts[4] || !rightParts[4]) {
		return leftParts[4] ? -1 : rightParts[4] ? 1 : 0;
	}
	const leftPre = leftParts[4].split('.');
	const rightPre = rightParts[4].split('.');
	for (let index = 0; index < Math.max(leftPre.length, rightPre.length); index += 1) {
		if (leftPre[index] === undefined || rightPre[index] === undefined) {
			return leftPre.length - rightPre.length;
		}
		if (leftPre[index] !== rightPre[index]) {
			const leftNumeric = /^\d+$/.test(leftPre[index]);
			const rightNumeric = /^\d+$/.test(rightPre[index]);
			return leftNumeric !== rightNumeric
				? leftNumeric
					? -1
					: 1
				: comparePart(leftPre[index], rightPre[index]);
		}
	}
	return 0;
}

/** Sanitize stored history so malformed fields cannot break startup or version comparisons. */
export function readReleaseHistory(value: unknown): ReleaseHistory {
	if (!value || typeof value !== 'object') {
		return emptyReleaseHistory();
	}
	const saved = value as ReleaseHistory;
	return {
		lastOpenedVersion: isReleaseVersion(saved.lastOpenedVersion)
			? saved.lastOpenedVersion
			: null,
		handledThroughVersion: isReleaseVersion(saved.handledThroughVersion)
			? saved.handledThroughVersion
			: null,
		pending:
			saved.pending &&
			isReleaseVersion(saved.pending.to) &&
			(saved.pending.first === undefined || isReleaseVersion(saved.pending.first)) &&
			(saved.pending.from === null ||
				(isReleaseVersion(saved.pending.from) &&
					compareReleaseVersions(saved.pending.from, saved.pending.to) < 0))
				? { ...saved.pending }
				: null,
	};
}

/** Select newest-first notes after a known baseline, or only the known releases of an unknown upgrade. */
export function releasesInRange<Release extends ReleaseMetadata>(
	releases: Release[],
	range: ReleaseRange
): Release[] {
	return releases
		.filter(
			(release) =>
				compareReleaseVersions(release.version, range.to) <= 0 &&
				(range.from === null
					? compareReleaseVersions(release.version, range.first ?? range.to) >= 0
					: compareReleaseVersions(release.version, range.from) > 0)
		)
		.sort((left, right) => compareReleaseVersions(right.version, left.version));
}

/**
 * Record a successful startup using onboarding history captured before UI mounts.
 * Fresh installs and unannounced releases are handled silently. Updates accumulate pending
 * notes until presentation; downgrades preserve newer acknowledgements and pending ranges.
 */
export function nextReleaseHistory(
	saved: ReleaseHistory,
	current: string,
	firstSetup: boolean,
	releases = RELEASES
): ReleaseHistory {
	const history = { ...saved, lastOpenedVersion: current };
	const handled = saved.handledThroughVersion;
	if (firstSetup) {
		history.handledThroughVersion =
			handled && compareReleaseVersions(handled, current) > 0 ? handled : current;
		history.pending = null;
		return history;
	}
	if (handled && compareReleaseVersions(current, handled) <= 0) {
		return history;
	}
	// Keep a future pending range intact while running a downgraded build.
	if (saved.pending && compareReleaseVersions(current, saved.pending.to) < 0) {
		return history;
	}
	const baseline = saved.pending?.from ?? saved.lastOpenedVersion;
	if (!saved.pending && baseline && compareReleaseVersions(current, baseline) <= 0) {
		return history;
	}
	const range = {
		from: saved.pending ? saved.pending.from : baseline,
		to: current,
		...(saved.pending?.from === null ? { first: saved.pending.first ?? saved.pending.to } : {}),
	};
	if (releasesInRange(releases, range).some((release) => release.announce)) {
		history.pending = range;
	} else {
		history.pending = null;
		history.handledThroughVersion = current;
	}
	return history;
}

const HISTORY_DOCUMENT_ID = '_local/syng-release-history';
const NOT_FOUND_STATUS = 404;
const CONFLICT_STATUS = 409;

interface HistoryDocument {
	_id: string;
	_rev?: string;
	history?: unknown;
	whatsNew?: { value?: unknown };
}

interface HistoryDatabase {
	get(identifier: string): Promise<HistoryDocument>;
	put(document: HistoryDocument): Promise<{ ok: boolean }>;
}

declare const PouchDB: new (name: string) => HistoryDatabase;

/** Create a history repository in the selected production or development configuration DB. */
export function createReleaseHistoryStorage(databaseName: string) {
	let database: HistoryDatabase | undefined;
	let writeQueue = Promise.resolve();
	const databaseConnection = () => (database ??= new PouchDB(databaseName));

	// Only a missing document means "no history"; storage failures must reach the caller.
	async function readDocument(identifier: string): Promise<HistoryDocument | undefined> {
		try {
			return await databaseConnection().get(identifier);
		} catch (error) {
			const failure = error as { status?: number; name?: string } | null;
			if (failure?.status === NOT_FOUND_STATUS || failure?.name === 'not_found') {
				return undefined;
			}
			throw error;
		}
	}

	async function write(history: ReleaseHistory): Promise<void> {
		const existing = await readDocument(HISTORY_DOCUMENT_ID);
		const response = await databaseConnection().put({
			_id: HISTORY_DOCUMENT_ID,
			...(existing?._rev ? { _rev: existing._rev } : {}),
			history,
		});
		if (!response.ok) {
			throw new Error(
				'Cannot save release history. The database did not confirm the write.',
				{
					cause: response,
				}
			);
		}
	}

	return {
		/** Prefer local history; migrate the old preference on the next successful save. */
		async load(): Promise<ReleaseHistory> {
			await writeQueue;
			const existing = await readDocument(HISTORY_DOCUMENT_ID);
			if (existing) {
				return readReleaseHistory(existing.history);
			}
			return readReleaseHistory((await readDocument('config'))?.whatsNew?.value);
		},
		/**
		 * Await a confirmed write; retry one revision conflict and let callers report failures.
		 * Local documents are excluded from normal config backups. No preference cache changes
		 * before saving, and a rejected operation does not block later queued writes.
		 */
		save(history: ReleaseHistory): Promise<void> {
			const snapshot = readReleaseHistory(history);
			const operation = writeQueue.then(async () => {
				try {
					await write(snapshot);
				} catch (error) {
					const failure = error as { status?: number; name?: string } | null;
					if (failure?.status !== CONFLICT_STATUS && failure?.name !== 'conflict') {
						throw error;
					}
					await write(snapshot);
				}
				return undefined;
			});
			writeQueue = operation.catch(() => {});
			return operation;
		},
	};
}
