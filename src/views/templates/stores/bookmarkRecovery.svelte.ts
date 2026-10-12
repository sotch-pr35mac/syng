import { invoke } from '@tauri-apps/api/core';
import { NATIVE_COMMANDS } from '@/types/nativeCommands.js';

let report = $state<string | null>(null);

async function copy(): Promise<void> {
	if (!report) {
		return;
	}
	await navigator.clipboard.writeText(report);
}

async function save(): Promise<void> {
	if (!report) {
		return;
	}
	await invoke(NATIVE_COMMANDS.BOOKMARKS.SAVE_RECOVERY_REPORT, { report });
}

async function openSaved(): Promise<boolean> {
	const savedReport = await invoke<string | null>(NATIVE_COMMANDS.BOOKMARKS.READ_RECOVERY_REPORT);
	if (!savedReport?.trim()) {
		return false;
	}
	report = savedReport;
	return true;
}

async function hasSaved(): Promise<boolean> {
	const savedReport = await invoke<string | null>(NATIVE_COMMANDS.BOOKMARKS.READ_RECOVERY_REPORT);
	return Boolean(savedReport?.trim());
}

export const bookmarkRecoveryStore = {
	get active(): boolean {
		return report !== null;
	},
	get report(): string {
		return report ?? '';
	},
	show(nextReport: string): void {
		report = nextReport;
	},
	dismiss(): void {
		report = null;
	},
	copy,
	save,
	hasSaved,
	openSaved,
	resetForTest(): void {
		report = null;
	},
};
