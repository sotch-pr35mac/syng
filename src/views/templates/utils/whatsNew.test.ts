import { describe, expect, it } from 'vitest';
import {
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
