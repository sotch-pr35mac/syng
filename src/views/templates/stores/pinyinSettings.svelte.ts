import { getPreferenceManager } from '@/utils/appServices.js';
import { notifyCharacterDisplay } from '@/utils/characterDisplay.js';

let showCharacterPinyin = $state(false);
let showFlashcardPinyin = $state(false);
let characterRevision = 0;
let flashcardRevision = 0;

async function loadSettings(): Promise<void> {
	const characterStarted = characterRevision;
	const flashcardStarted = flashcardRevision;
	const preferences = getPreferenceManager();
	await preferences.waitForInit();
	if (characterStarted === characterRevision) {
		showCharacterPinyin = preferences.get('showCharacterPinyin') === true;
	}
	if (flashcardStarted === flashcardRevision) {
		showFlashcardPinyin = preferences.get('showFlashcardPinyin') === true;
	}
}

export const pinyinSettingsStore = {
	get showCharacterPinyin() {
		return showCharacterPinyin;
	},
	get showFlashcardPinyin() {
		return showFlashcardPinyin;
	},
	loadSettings,
	setCharacterPinyin(checked: boolean): void {
		characterRevision += 1;
		showCharacterPinyin = checked;
		getPreferenceManager().set('showCharacterPinyin', checked);
		notifyCharacterDisplay({ showPinyin: checked });
	},
	setFlashcardPinyin(checked: boolean): void {
		flashcardRevision += 1;
		showFlashcardPinyin = checked;
		getPreferenceManager().set('showFlashcardPinyin', checked);
	},
};
