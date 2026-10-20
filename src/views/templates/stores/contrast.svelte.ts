/**
 * Apply the saved Increase Contrast preference before either app window mounts.
 * localStorage is an optional startup cache and a same-origin window notification;
 * the preference manager remains the persisted source of truth.
 */
import { getPreferenceManager } from '@/utils/appServices.js';
import { telemetry } from '@/utils/telemetry.js';

const PREFERENCE_KEY = 'increaseContrast';
const CACHE_KEY = 'syng:appearance';
const TONE_COLOR_COUNT = 5;
// Match the preference database selected by Syng's debugMode argument. This flag
// is separate from Tauri's compiler profile; different builds need not share storage.
let cacheKey = CACHE_KEY;
let increaseContrast = $state(false);
let customToneColors: string[] = [];
// Increment for an explicit toggle or a change received from another window.
// An older asynchronous preference read must not overwrite that newer choice.
let revision = 0;
// Increment when initialize() starts a new store lifetime. Reads started in an
// earlier lifetime must not apply preferences or cache data to the new one.
let initialization = 0;
let stopListening: (() => void) | undefined;

/** Update the root appearance selector and the five tone overrides without reading layout. */
function applyAppearance(): void {
	const root = document.documentElement;
	root.dataset.appearance = increaseContrast ? 'contrast' : 'original';
	// User-selected tones take precedence in both appearances. With no custom
	// color, leave the token to the current theme rather than setting an override.
	for (let index = 0; index < TONE_COLOR_COUNT; index += 1) {
		const token = `--sy-tone-color--${index + 1}`;
		const customColor = customToneColors[index];
		if (customColor) {
			root.style.setProperty(token, customColor);
		} else {
			root.style.removeProperty(token);
		}
	}
}

/** Cache the current choice for startup and notify other windows sharing this storage area. */
function cacheAppearance(): void {
	try {
		window.localStorage.setItem(cacheKey, increaseContrast ? 'contrast' : 'original');
	} catch {
		// Preferences remain authoritative if this optional startup cache is unavailable.
	}
}

/** Apply before mounting either window; match the cache to Syng's preference-database mode. */
function initialize(debugMode = false): () => void {
	stopListening?.();
	initialization += 1;
	cacheKey = debugMode ? `${CACHE_KEY}:development` : CACHE_KEY;
	customToneColors = [];
	try {
		increaseContrast = window.localStorage.getItem(cacheKey) === 'contrast';
	} catch {
		increaseContrast = false;
	}
	applyAppearance();
	// Event-driven, with no polling. Storage events arrive in other windows sharing
	// this origin/storage area; setIncreaseContrast() updates the initiating window.
	const handleStorage = (event: StorageEvent): void => {
		if (event.key !== cacheKey || !['original', 'contrast'].includes(event.newValue ?? '')) {
			return;
		}
		revision += 1;
		increaseContrast = event.newValue === 'contrast';
		applyAppearance();
	};
	window.addEventListener('storage', handleStorage);
	stopListening = () => window.removeEventListener('storage', handleStorage);
	return stopListening;
}

/** Load persisted preferences, retaining newer changes made while initialization was pending. */
async function loadSettings(): Promise<void> {
	const loadRevision = revision;
	const loadInitialization = initialization;
	const preferences = getPreferenceManager();
	await preferences.waitForInit();
	if (loadInitialization !== initialization) {
		return;
	}
	if (loadRevision === revision) {
		increaseContrast = preferences.get(PREFERENCE_KEY) === true;
	}
	const tonePreference = preferences.get('toneColors');
	customToneColors =
		tonePreference?.hasCustomColors && Array.isArray(tonePreference.colors)
			? tonePreference.colors
					.slice(0, TONE_COLOR_COUNT)
					.map((color: unknown) => (typeof color === 'string' ? color : ''))
			: [];
	applyAppearance();
	cacheAppearance();
}

/** Persist a local toggle, apply it immediately, and refresh the startup cache. */
function setIncreaseContrast(
	checked: boolean,
	source: 'settings' | 'whats_new' = 'settings'
): void {
	const changed = increaseContrast !== checked;
	getPreferenceManager().set(PREFERENCE_KEY, checked);
	revision += 1;
	increaseContrast = checked;
	applyAppearance();
	cacheAppearance();
	if (changed) {
		telemetry
			.trackEvent('settings.changed', { setting: PREFERENCE_KEY, source })
			.catch(() => {});
	}
}

export const contrastStore = {
	get increaseContrast(): boolean {
		return increaseContrast;
	},
	initialize,
	loadSettings,
	setIncreaseContrast,
};
