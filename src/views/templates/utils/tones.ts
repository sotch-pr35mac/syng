export const NO_TONE_INDEX = 5;

/** Scheme-aware defaults; custom tone preferences remain independent of these theme roles. */
export const DEFAULT_TONE_COLOR_TOKENS = [
	'--sy-tone-default--1',
	'--sy-tone-default--2',
	'--sy-tone-default--3',
	'--sy-tone-default--4',
	'--sy-tone-default--5',
] as const;

type ToneColorClassPrefix = 'colored-pinyin' | 'colored-characters';

export function toneColorClass(
	tone: number | null | undefined,
	prefix: ToneColorClassPrefix = 'colored-pinyin'
): string {
	return `${prefix}--tone-${tone || NO_TONE_INDEX}`;
}
