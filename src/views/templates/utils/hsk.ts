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
export function resolveHskLevels(hsk: HskLevels | undefined, variant: HskVariant): string[] {
	if (variant === HSK_VARIANTS.NONE || !hsk || !Object.values(HSK_VARIANTS).includes(variant)) {
		return [];
	}
	const levels = hsk[variant as keyof HskLevels];
	if (!Array.isArray(levels)) {
		return [];
	}
	return levels
		.map((level) => levelNumber[level])
		.filter((level): level is string => Boolean(level));
}
