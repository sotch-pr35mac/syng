import {
	CHARACTER_SETS,
	type CharacterScript,
	type CharacterSet,
} from '@/types/dictionaryDisplay.js';

export interface CharacterForm {
	script: CharacterScript;
	characters: string;
	showLabel: boolean;
}

function unsupportedCharacterSet(characterSet: never): never {
	throw new Error(`Unsupported character set: ${characterSet}`);
}

export function resolveCharacterForms(
	simplified: string,
	traditional: string,
	characterSet: CharacterSet
): CharacterForm[] {
	switch (characterSet) {
		case CHARACTER_SETS.SIMPLIFIED:
			return [
				{
					script: CHARACTER_SETS.SIMPLIFIED,
					characters: simplified,
					showLabel: false,
				},
			];
		case CHARACTER_SETS.TRADITIONAL:
			return [
				{
					script: CHARACTER_SETS.TRADITIONAL,
					characters: traditional,
					showLabel: false,
				},
			];
		case CHARACTER_SETS.BOTH:
			if (simplified === traditional) {
				return [
					{
						script: CHARACTER_SETS.SIMPLIFIED,
						characters: simplified,
						showLabel: false,
					},
				];
			}
			return [
				{
					script: CHARACTER_SETS.SIMPLIFIED,
					characters: simplified,
					showLabel: true,
				},
				{
					script: CHARACTER_SETS.TRADITIONAL,
					characters: traditional,
					showLabel: true,
				},
			];
		default:
			return unsupportedCharacterSet(characterSet);
	}
}
