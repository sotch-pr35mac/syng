/**
 * Coordinates automatic release announcements, Settings replays, and developer previews.
 * Startup saves the pending range before the gate navigates; the page acknowledges it only
 * after content renders. Preview never changes history or emits usage events. Return-route,
 * disclosure, and scroll state survive temporary navigation from a release-note action.
 */
import { getVersion } from '@tauri-apps/api/app';
import { push, replace } from 'svelte-spa-router';
import { getReleaseHistoryStorage } from '@/utils/appServices.js';
import { handleError } from '@/utils/error.js';
import { telemetry } from '@/utils/telemetry.js';
import type { WhatsNewTelemetry } from '@/types/telemetry.js';
import { isIos, isAndroid } from '@/utils/device.js';
import {
	RELEASES,
	compareReleaseVersions,
	emptyReleaseHistory,
	isReleaseVersion,
	nextReleaseHistory,
	releasesInRange,
} from '@/utils/whatsNew.js';
import type { ReleasePlatform, ReleaseRange } from '@/types/whatsNew.js';

// iOS needs its own notes (for example Dynamic Type); current desktop notes are shared.
const releasePlatform = (): ReleasePlatform =>
	isIos() ? 'ios' : isAndroid() ? 'android' : 'desktop';
const availableReleases = () =>
	RELEASES.filter(
		(release) => !release.platforms || release.platforms.includes(releasePlatform())
	);

let currentVersion = $state('');
let history = emptyReleaseHistory();
let range = $state<ReleaseRange | null>(null);
let preview = false;
let returnRoute = '/';
let launchRoute = '/';
let position = 0;
let expanded = false;
let presentationSaved = false;
let startupOffered = false;
let navigating = $state(false);
let source: WhatsNewTelemetry['source'] = 'direct';
let continued = false;

/** Send content-level events without private return routes; previews are excluded. */
function track(
	event: 'viewed' | 'continued' | 'disclosure_changed' | 'action',
	details: Partial<WhatsNewTelemetry> = {}
): void {
	if (range && !preview) {
		telemetry
			.trackEvent(`whats_new.${event}`, {
				from_version: range.from,
				to_version: range.to,
				source,
				...details,
			})
			.catch(() => {});
	}
}

/** Cache the validated native version for this application session. */
async function resolveVersion(): Promise<string> {
	if (!currentVersion) {
		const version = await getVersion();
		if (!isReleaseVersion(version)) {
			throw new Error('The installed app version is invalid.');
		}
		currentVersion = version;
	}
	return currentVersion;
}

/** Prepare and persist the upgrade range after startup succeeds; failures leave the app usable. */
async function initialize(
	firstSetup: boolean,
	initialRoute = window.location.hash.slice(1) || '/'
): Promise<void> {
	launchRoute = initialRoute;
	try {
		const version = await resolveVersion();
		const storage = getReleaseHistoryStorage();
		history = nextReleaseHistory(
			await storage.load(),
			version,
			firstSetup,
			availableReleases()
		);
		await storage.save(history);
		navigating = history.pending?.to === version;
	} catch (error) {
		history = emptyReleaseHistory();
		navigating = false;
		handleError('Could not prepare release notes.', error, { silent: true });
	}
}

/** Called once by the startup gate after onboarding and recovery stop blocking navigation. */
async function openPending(): Promise<void> {
	if (
		startupOffered ||
		!history.pending ||
		history.pending.to !== currentVersion ||
		!releasesInRange(availableReleases(), history.pending).length
	) {
		return;
	}
	startupOffered = true;
	range = { ...history.pending };
	preview = false;
	presentationSaved = false;
	continued = false;
	source = 'update';
	position = 0;
	expanded = false;
	returnRoute = launchRoute;
	if (returnRoute.startsWith('/whats-new')) {
		returnRoute = '/';
	}
	try {
		await replace('/whats-new');
	} finally {
		navigating = false;
	}
}

/** Open a manual replay or preview, preserving the Settings route for Continue. */
async function open(isPreview = false): Promise<void> {
	try {
		await resolveVersion();
	} catch {
		// The bundled release remains readable even when native version lookup fails.
		currentVersion = RELEASES[0].version;
	}
	range = { from: null, to: currentVersion };
	preview = isPreview;
	presentationSaved = false;
	continued = false;
	source = 'settings';
	position = 0;
	expanded = false;
	returnRoute = window.location.hash.slice(1) || '/settings';
	if (returnRoute.startsWith('/whats-new')) {
		returnRoute = '/settings';
	}
	await push('/whats-new');
}

/** Acknowledge rendered notes once, preserving pending history if storage fails. */
async function markPresented(): Promise<void> {
	if (presentationSaved || !range) {
		return;
	}
	presentationSaved = true;
	track('viewed');
	if (preview) {
		return;
	}
	try {
		const storage = getReleaseHistoryStorage();
		const saved = await storage.load();
		if (
			saved.handledThroughVersion &&
			compareReleaseVersions(saved.handledThroughVersion, range.to) >= 0
		) {
			return;
		}
		const next = {
			...saved,
			handledThroughVersion: range.to,
			pending:
				saved.pending && compareReleaseVersions(saved.pending.to, range.to) > 0
					? saved.pending
					: null,
		};
		await storage.save(next);
		history = next;
	} catch (error) {
		handleError('Could not save release-note history.', error, { silent: true });
	}
}

/** Support direct visits and restore the current presentation after a linked action. */
async function preparePage(): Promise<void> {
	if (continued) {
		presentationSaved = false;
		continued = false;
		preview = false;
		source = 'direct';
	}
	if (!range) {
		try {
			await resolveVersion();
		} catch {
			currentVersion = RELEASES[0].version;
		}
		range = { from: null, to: currentVersion };
	}
}

/** Save a developer baseline before reloading; report operational errors, not invalid input. */
async function simulateUpdate(previousVersion: string): Promise<void> {
	let version: string;
	try {
		version = await resolveVersion();
	} catch (error) {
		handleError('Could not simulate the update.', error, { silent: true });
		throw error;
	}
	if (
		!isReleaseVersion(previousVersion) ||
		compareReleaseVersions(previousVersion, version) >= 0
	) {
		throw new Error(`Enter a version older than ${version}, such as 2.5.3.`);
	}
	try {
		await getReleaseHistoryStorage().save({
			lastOpenedVersion: previousVersion,
			handledThroughVersion: previousVersion,
			pending: null,
		});
	} catch (error) {
		handleError('Could not simulate the update.', error, { silent: true });
		throw error;
	}
	window.location.reload();
}

export const whatsNewStore = {
	get platform() {
		return releasePlatform();
	},
	get range() {
		return range;
	},
	get version() {
		return currentVersion;
	},
	get navigating() {
		return navigating;
	},
	get position() {
		return position;
	},
	set position(value: number) {
		position = value;
	},
	get expanded() {
		return expanded;
	},
	set expanded(value: boolean) {
		if (expanded !== value) {
			track('disclosure_changed', { section: 'improvements', expanded: value });
		}
		expanded = value;
	},
	initialize,
	openPending,
	open,
	resolveVersion,
	markPresented,
	simulateUpdate,
	preparePage,
	disclose: (section: 'cumulative' | 'earlier', expanded: boolean) =>
		track('disclosure_changed', { section, expanded }),
	action: (section: string, setting?: string) =>
		track('action', {
			target_section: section,
			...(setting ? { target_setting: setting } : {}),
		}),
	continue: () => {
		if (!continued) {
			continued = true;
			track('continued', { content_presented: presentationSaved, expanded });
		}
		return replace(returnRoute);
	},
	back: () => replace('/whats-new'),
};
