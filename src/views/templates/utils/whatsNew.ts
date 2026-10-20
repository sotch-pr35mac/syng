import type { ReleaseHistory, ReleaseMetadata, ReleaseRange } from '@/types/whatsNew.js';

// Keep startup metadata small. Detailed, interactive notes load with the page.
export const RELEASES: ReleaseMetadata[] = [
	{ version: '2.6.0', date: '2026-10-20', announce: true },
];

export const emptyReleaseHistory = (): ReleaseHistory => ({
	lastOpenedVersion: null,
	handledThroughVersion: null,
	pending: null,
});

const VERSION =
	/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

export function isReleaseVersion(value: unknown): value is string {
	if (typeof value !== 'string' || !VERSION.test(value)) {
		return false;
	}
	const prerelease = value.match(VERSION)![4];
	return !prerelease?.split('.').some((part) => /^\d+$/.test(part) && /^0\d/.test(part));
}

function comparePart(left: string, right: string): number {
	if (/^\d+$/.test(left) && /^\d+$/.test(right)) {
		return left.length - right.length || (left < right ? -1 : left > right ? 1 : 0);
	}
	return left < right ? -1 : left > right ? 1 : 0;
}

/** SemVer precedence, including prereleases; build metadata does not affect ordering. */
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

/** Called only after a successful startup, using onboarding history captured before UI mounts. */
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
