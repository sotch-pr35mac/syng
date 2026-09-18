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
	simplified: string | null | undefined,
	traditional: string | null | undefined,
	characterSet: CharacterSet
): CharacterForm[] {
	const hasSimplified = typeof simplified === 'string' && simplified.length > 0;
	const hasTraditional = typeof traditional === 'string' && traditional.length > 0;
	const simplifiedCharacters = hasSimplified ? simplified : (traditional ?? '');
	const traditionalCharacters = hasTraditional ? traditional : (simplified ?? '');

	switch (characterSet) {
		case CHARACTER_SETS.SIMPLIFIED:
			return [
				{
					script: hasSimplified ? CHARACTER_SETS.SIMPLIFIED : CHARACTER_SETS.TRADITIONAL,
					characters: simplifiedCharacters,
					showLabel: !hasSimplified,
				},
			];
		case CHARACTER_SETS.TRADITIONAL:
			return [
				{
					script: hasTraditional ? CHARACTER_SETS.TRADITIONAL : CHARACTER_SETS.SIMPLIFIED,
					characters: traditionalCharacters,
					showLabel: !hasTraditional,
				},
			];
		case CHARACTER_SETS.BOTH:
			if (!hasSimplified && !hasTraditional) {
				return [];
			}
			if (!hasSimplified || !hasTraditional || simplified === traditional) {
				return [
					{
						script: hasSimplified
							? CHARACTER_SETS.SIMPLIFIED
							: CHARACTER_SETS.TRADITIONAL,
						characters: simplifiedCharacters,
						showLabel: !hasSimplified || !hasTraditional,
					},
				];
			}
			return [
				{
					script: CHARACTER_SETS.SIMPLIFIED,
					characters: simplifiedCharacters,
					showLabel: true,
				},
				{
					script: CHARACTER_SETS.TRADITIONAL,
					characters: traditionalCharacters,
					showLabel: true,
				},
			];
		default:
			return unsupportedCharacterSet(characterSet);
	}
}
