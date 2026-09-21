export type ToolName = 'pinyinify' | 'converter' | 'colorize' | 'prettify';
import type { LexicalUnit } from '@/types/dictionary.js';

export interface PinyinSegment {
	source: string;
	lexical_unit?: LexicalUnit | null;
	/** Render-only fallback for pre-schema-4 fixtures; native commands return lexical_unit. */
	word_data?: unknown;
}

export interface PinyinToken {
	text: string;
	tone: number | null;
}

export type ColorizeMode = 'automatic' | 'characters' | 'pinyin';
export type CharacterScript = 'automatic' | 'simplified' | 'traditional';
export type DetectedCharacterScript = 'simplified' | 'traditional' | 'unknown';
export type ConvertDirection = 'automatic' | 'to_simplified' | 'to_traditional';
export type ResolvedConvertDirection = Exclude<ConvertDirection, 'automatic'>;
export type PrettifyDirection = 'automatic' | 'to_marks' | 'to_numbers';
export type ResolvedPrettifyDirection = Exclude<PrettifyDirection, 'automatic'>;
export type PinyinStyle = 'marks' | 'numbers' | 'unknown';

export interface ConvertCharactersResult {
	text: string;
	direction: ResolvedConvertDirection;
	detected_script: DetectedCharacterScript;
}

export interface PrettifyPinyinResult {
	text: string;
	direction: ResolvedPrettifyDirection;
	detected_style: PinyinStyle;
}
