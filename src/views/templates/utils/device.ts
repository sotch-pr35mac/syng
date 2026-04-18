import { platform } from '@tauri-apps/plugin-os';

// Gracefully handle environments where the Tauri runtime isn't available (e.g. tests).
let _platform: string;
try {
	_platform = platform();
} catch {
	_platform = 'unknown';
}

// iPads are mobile hardware and should be treated as mobile for most purposes
// (e.g. skipping updates, opening characters inline). Only specific call sites
// that want iPad to behave like desktop (e.g. rendering the desktop UI) should
// additionally check !isIPad().
export const isMobile = (): boolean => _platform === 'ios' || _platform === 'android';

export const isIPad = (): boolean =>
	_platform === 'ios' &&
	(/iPad/.test(navigator.userAgent) ||
		(/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1));
