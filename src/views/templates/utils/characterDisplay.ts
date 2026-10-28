import { emitTo } from '@tauri-apps/api/event';
import type { Pinyin } from '@/types/dictionary.js';
import type { CharacterScript } from '@/types/dictionaryDisplay.js';

export const CHARACTER_DISPLAY_SETTINGS_EVENT = 'character-display-settings-changed';

export interface CharacterDisplaySettings {
	showPinyin: boolean;
	colorByTone: boolean;
	toneColors?: string[];
}

export interface CharacterWindowWord {
	simplified: string;
	traditional: string;
	initialScript?: CharacterScript;
	pinyin?: Pinyin;
	displaySettings?: CharacterDisplaySettings;
}

/** The main app owns preferences; the secondary window only receives display state. */
export function notifyCharacterDisplay(settings: Partial<CharacterDisplaySettings>): void {
	void emitTo('characters', CHARACTER_DISPLAY_SETTINGS_EVENT, settings).catch(() => {});
}
