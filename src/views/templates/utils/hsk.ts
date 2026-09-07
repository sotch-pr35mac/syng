import type { HskLevels, HskLevel } from '@/types/hsk.js';
import type { HskVariant } from '@/types/dictionaryDisplay.js';
const levelNumber: Record<HskLevel, string> = {
	One: '1',
	Two: '2',
	Three: '3',
	Four: '4',
	Five: '5',
	Six: '6',
	SevenToNine: '7–9',
};
export function resolveHskLevels(
	hsk: HskLevels | number | undefined,
	variant: HskVariant
): string[] {
	if (variant === 'none' || hsk === undefined || hsk === null) {
		return [];
	}
	if (typeof hsk === 'number') {
		return hsk > 0 && variant === 'hsk_2015' ? [String(hsk)] : [];
	}
	return (hsk[variant] ?? []).map((level) => levelNumber[level]).filter(Boolean);
}
