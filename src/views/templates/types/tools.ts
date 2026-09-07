export type ToolName = 'pinyinify' | 'converter' | 'colorize' | 'prettify';
import type { HskLevels } from '@/types/hsk.js';

export interface WordData {
	traditional: string;
	simplified: string;
	pinyin_marks: string;
	pinyin_numbers: string;
	tone_marks: number[];
	english: string[];
	hash: number;
	hsk: HskLevels | number;
	word_id: number;
}

export interface PinyinSegment {
	source: string;
	word_data: WordData | null;
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
