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

export const isIos = (): boolean => _platform === 'ios';

export const isAndroid = (): boolean => _platform === 'android';

export const isIPad = (): boolean =>
	_platform === 'ios' &&
	(/iPad/.test(navigator.userAgent) ||
		(/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1));

// True when the device uses the mobile UI layout (phones and Android tablets).
// iPads run iOS but use the desktop UI, so they are excluded here — this mirrors
// the shell selection in app.js. Prefer this over isMobile() for layout decisions
// (e.g. popover vs. bottom sheet) that should follow the desktop UI on iPad.
export const isMobileLayout = (): boolean => isMobile() && !isIPad();
