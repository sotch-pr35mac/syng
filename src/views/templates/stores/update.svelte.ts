import type { Update } from '@tauri-apps/plugin-updater';

let currentVersion = $state('');
let updateVersion = $state('');
let releaseNotes = $state('');
let knownStatus = $state(false);
let updateAvailable = $state(false);
let pendingUpdate = $state<Update | null>(null);

export const updateStore = {
	get currentVersion(): string {
		return currentVersion;
	},
	get updateVersion(): string {
		return updateVersion;
	},
	get releaseNotes(): string {
		return releaseNotes;
	},
	get knownStatus(): boolean {
		return knownStatus;
	},
	get updateAvailable(): boolean {
		return updateAvailable;
	},
	get pendingUpdate(): Update | null {
		return pendingUpdate;
	},
	setCurrentVersion(version: string): void {
		currentVersion = version;
	},
	setCheckResult(update: Update | null): void {
		knownStatus = true;
		updateAvailable = Boolean(update);
		updateVersion = update?.version ?? '';
		releaseNotes = update?.body ?? '';
		pendingUpdate = update;
	},
	resetStatus(): void {
		updateVersion = '';
		releaseNotes = '';
		knownStatus = false;
		updateAvailable = false;
		pendingUpdate = null;
	},
};
