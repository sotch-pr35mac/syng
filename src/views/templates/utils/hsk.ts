import { HSK_LEVELS, type HskLevels, type HskLevel } from '@/types/hsk.js';
import { HSK_VARIANTS, type HskVariant } from '@/types/dictionaryDisplay.js';
const levelNumber: Record<HskLevel, string> = {
	[HSK_LEVELS.ONE]: '1',
	[HSK_LEVELS.TWO]: '2',
	[HSK_LEVELS.THREE]: '3',
	[HSK_LEVELS.FOUR]: '4',
	[HSK_LEVELS.FIVE]: '5',
	[HSK_LEVELS.SIX]: '6',
	[HSK_LEVELS.SEVEN_TO_NINE]: '7–9',
};
const HSK_LEVEL_COUNT = 6;
export function resolveHskLevels(
	hsk: HskLevels | number | undefined,
	variant: HskVariant
): string[] {
	if (variant === HSK_VARIANTS.NONE || hsk === undefined || hsk === null) {
		return [];
	}
	if (typeof hsk === 'number') {
		return hsk > 0 && hsk <= HSK_LEVEL_COUNT && variant === HSK_VARIANTS.HSK_2015
			? [String(hsk)]
			: [];
	}
	return (hsk[variant] ?? []).map((level) => levelNumber[level]).filter(Boolean);
}
