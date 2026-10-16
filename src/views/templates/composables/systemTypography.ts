import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { SystemTypographySnapshot } from '@/types/accessibility.js';
import { NATIVE_COMMANDS } from '@/types/nativeCommands.js';

const DEFAULT_ROOT_FONT_SIZE_PX = 16;
const SYSTEM_TYPOGRAPHY_CHANGED = 'system-typography-changed';

type TypographyListener = (_snapshot: SystemTypographySnapshot) => void;

let snapshot: SystemTypographySnapshot = {
	rootFontSizePx: DEFAULT_ROOT_FONT_SIZE_PX,
	revision: 0,
};
const listeners = new Set<TypographyListener>();
let initialization: Promise<() => void> | undefined;

export function getSystemTypographySnapshot(): SystemTypographySnapshot {
	return { ...snapshot };
}

/** Immediately supplies the current size, then reports accepted native updates. */
export function subscribeSystemTypography(listener: TypographyListener): () => void {
	listeners.add(listener);
	listener(getSystemTypographySnapshot());
	return () => listeners.delete(listener);
}

function isValidSnapshot(value: unknown): value is SystemTypographySnapshot {
	if (!value || typeof value !== 'object') {
		return false;
	}
	const candidate = value as Partial<SystemTypographySnapshot>;
	return (
		typeof candidate.rootFontSizePx === 'number' &&
		Number.isFinite(candidate.rootFontSizePx) &&
		candidate.rootFontSizePx > 0 &&
		typeof candidate.revision === 'number' &&
		Number.isSafeInteger(candidate.revision) &&
		candidate.revision >= 0
	);
}

function applySnapshot(value: unknown): void {
	if (!isValidSnapshot(value) || value.revision < snapshot.revision) {
		return;
	}
	const changed = value.rootFontSizePx !== snapshot.rootFontSizePx;
	snapshot = { ...value };
	document.documentElement.style.setProperty(
		'--sy-system-font-size',
		`${snapshot.rootFontSizePx}px`
	);
	document.documentElement.style.setProperty(
		'--sy-system-text-scale',
		`${snapshot.rootFontSizePx / DEFAULT_ROOT_FONT_SIZE_PX}`
	);
	if (changed) {
		for (const listener of listeners) {
			listener(getSystemTypographySnapshot());
		}
	}
}

/**
 * Start before mounting either app shell. Native settings remain the source of truth;
 * no user preference, page zoom, or Reader content setting is changed here.
 */
export function initializeSystemTypography(): Promise<() => void> {
	if (initialization) {
		return initialization;
	}
	initialization = startSystemTypography();
	return initialization;
}

async function startSystemTypography(): Promise<() => void> {
	let disposed = false;
	let stopListening: UnlistenFn | undefined;
	const acceptSnapshot = (value: unknown) => {
		if (!disposed) {
			applySnapshot(value);
		}
	};
	const refresh = async () => {
		try {
			acceptSnapshot(await invoke(NATIVE_COMMANDS.APP.GET_SYSTEM_TYPOGRAPHY));
		} catch {
			// Browser previews and an unavailable platform API retain the last valid size.
		}
	};
	const handleVisibilityChange = () => {
		if (document.visibilityState === 'visible') {
			void refresh();
		}
	};
	const handlePageShow = () => {
		void refresh();
	};

	try {
		// Subscribe first so a setting changed during the initial read cannot be lost.
		stopListening = await listen<SystemTypographySnapshot>(
			SYSTEM_TYPOGRAPHY_CHANGED,
			(event) => {
				acceptSnapshot(event.payload);
			}
		);
	} catch {
		// A snapshot is still useful when live native events are unavailable.
	}
	document.addEventListener('visibilitychange', handleVisibilityChange);
	window.addEventListener('pageshow', handlePageShow);
	await refresh();

	return () => {
		if (disposed) {
			return;
		}
		disposed = true;
		stopListening?.();
		document.removeEventListener('visibilitychange', handleVisibilityChange);
		window.removeEventListener('pageshow', handlePageShow);
		initialization = undefined;
	};
}
