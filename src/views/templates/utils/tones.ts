export const NO_TONE_INDEX = 5;

type ToneColorClassPrefix = 'colored-pinyin' | 'colored-characters';

export function toneColorClass(
	tone: number | null | undefined,
	prefix: ToneColorClassPrefix = 'colored-pinyin'
): string {
	return `${prefix}--tone-${tone || NO_TONE_INDEX}`;
}
