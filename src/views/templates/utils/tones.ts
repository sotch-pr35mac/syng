export const NO_TONE_INDEX = 5;

export const THEME_TONE_COLOR_TOKENS = [
	'--sy-tone-theme--1',
	'--sy-tone-theme--2',
	'--sy-tone-theme--3',
	'--sy-tone-theme--4',
	'--sy-tone-theme--5',
] as const;

type ToneColorClassPrefix = 'colored-pinyin' | 'colored-characters';

export function toneColorClass(
	tone: number | null | undefined,
	prefix: ToneColorClassPrefix = 'colored-pinyin'
): string {
	return `${prefix}--tone-${tone || NO_TONE_INDEX}`;
}
