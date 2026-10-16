import { getPreferenceManager } from '@/utils/appServices.js';

const PREFERENCE_KEY = 'increaseContrast';
const CACHE_KEY = 'syng:appearance';
const TONE_COLOR_COUNT = 5;
let cacheKey = CACHE_KEY;
let increaseContrast = $state(false);
let customToneColors: string[] = [];
let revision = 0;
let initialization = 0;
let stopListening: (() => void) | undefined;

function applyAppearance(): void {
	const root = document.documentElement;
	root.dataset.appearance = increaseContrast ? 'contrast' : 'original';
	// The alternate presentation always uses its tested tone defaults. Switching
	// back restores the user's palette without changing their saved tone preference.
	for (let index = 0; index < TONE_COLOR_COUNT; index += 1) {
		const token = `--sy-tone-color--${index + 1}`;
		const customColor = customToneColors[index];
		if (!increaseContrast && customColor) {
			root.style.setProperty(token, customColor);
		} else {
			root.style.removeProperty(token);
		}
	}
}

function cacheAppearance(): void {
	try {
		window.localStorage.setItem(cacheKey, increaseContrast ? 'contrast' : 'original');
	} catch {
		// Preferences remain authoritative if this optional startup cache is unavailable.
	}
}

/** Apply before mounting either window; separate development and production caches. */
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

function setIncreaseContrast(checked: boolean): void {
	getPreferenceManager().set(PREFERENCE_KEY, checked);
	revision += 1;
	increaseContrast = checked;
	applyAppearance();
	cacheAppearance();
}

export const appearanceStore = {
	get increaseContrast(): boolean {
		return increaseContrast;
	},
	initialize,
	loadSettings,
	setIncreaseContrast,
};
