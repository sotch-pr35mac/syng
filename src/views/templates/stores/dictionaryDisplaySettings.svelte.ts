import {
	CHARACTER_SET_VALUES,
	CHARACTER_SETS,
	type CharacterSet,
	type DictionaryDisplaySettings,
	HSK_VARIANTS,
	HSK_VARIANT_VALUES,
	type HskVariant,
} from '@/types/dictionaryDisplay.js';
import { getPreferenceManager } from '@/utils/appServices.js';

export const DEFAULT_DICTIONARY_DISPLAY_SETTINGS: Readonly<DictionaryDisplaySettings> = {
	characterSet: CHARACTER_SETS.BOTH,
	colorCharactersByTone: true,
	colorPinyinByTone: false,
	colorListsByTone: false,
	hskVariant: HSK_VARIANTS.HSK_EXAM_SYLLABUS_2025,
};

let settings = $state<DictionaryDisplaySettings>({ ...DEFAULT_DICTIONARY_DISPLAY_SETTINGS });

function normalizeCharacterSet(value: unknown): CharacterSet {
	return CHARACTER_SET_VALUES.includes(value as CharacterSet)
		? (value as CharacterSet)
		: DEFAULT_DICTIONARY_DISPLAY_SETTINGS.characterSet;
}

function normalizeHskVariant(value: unknown): HskVariant {
	return HSK_VARIANT_VALUES.includes(value as HskVariant)
		? (value as HskVariant)
		: DEFAULT_DICTIONARY_DISPLAY_SETTINGS.hskVariant;
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
	return typeof value === 'boolean' ? value : fallback;
}

async function loadSettings(): Promise<void> {
	try {
		const preferenceManager = getPreferenceManager();
		await preferenceManager.waitForInit();
		settings = {
			characterSet: normalizeCharacterSet(preferenceManager.get('characterSet')),
			colorCharactersByTone: normalizeBoolean(
				preferenceManager.get('colorCharactersByTone'),
				DEFAULT_DICTIONARY_DISPLAY_SETTINGS.colorCharactersByTone
			),
			colorPinyinByTone: normalizeBoolean(
				preferenceManager.get('colorPinyinByTone'),
				DEFAULT_DICTIONARY_DISPLAY_SETTINGS.colorPinyinByTone
			),
			colorListsByTone: normalizeBoolean(
				preferenceManager.get('colorListsByTone'),
				DEFAULT_DICTIONARY_DISPLAY_SETTINGS.colorListsByTone
			),
			hskVariant: normalizeHskVariant(preferenceManager.get('hskVariant')),
		};
	} catch {
		settings = { ...DEFAULT_DICTIONARY_DISPLAY_SETTINGS };
	}
}

function setHskVariant(hskVariant: HskVariant): void {
	settings.hskVariant = normalizeHskVariant(hskVariant);
	getPreferenceManager().set('hskVariant', settings.hskVariant);
}

function setCharacterSet(characterSet: CharacterSet): void {
	settings.characterSet = normalizeCharacterSet(characterSet);
	getPreferenceManager().set('characterSet', settings.characterSet);
}

function setColorCharactersByTone(colorCharactersByTone: boolean): void {
	settings.colorCharactersByTone = colorCharactersByTone;
	getPreferenceManager().set('colorCharactersByTone', colorCharactersByTone);
}

function setColorPinyinByTone(colorPinyinByTone: boolean): void {
	settings.colorPinyinByTone = colorPinyinByTone;
	getPreferenceManager().set('colorPinyinByTone', colorPinyinByTone);
}

function setColorListsByTone(colorListsByTone: boolean): void {
	settings.colorListsByTone = colorListsByTone;
	getPreferenceManager().set('colorListsByTone', colorListsByTone);
}

export const dictionaryDisplaySettingsStore = {
	get settings(): DictionaryDisplaySettings {
		return settings;
	},
	loadSettings,
	setCharacterSet,
	setColorCharactersByTone,
	setColorPinyinByTone,
	setColorListsByTone,
	setHskVariant,
};
