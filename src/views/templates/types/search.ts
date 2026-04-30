import { NATIVE_COMMANDS } from '@/types/nativeCommands.js';

export const SEARCH_LANGS = ['EN', 'PY', 'ZH'] as const;
export type SearchLang = (typeof SEARCH_LANGS)[number];

export const LANG_COMMANDS: Record<SearchLang, string> = {
	EN: NATIVE_COMMANDS.DICTIONARY.QUERY_BY_ENGLISH,
	PY: NATIVE_COMMANDS.DICTIONARY.QUERY_BY_PINYIN,
	ZH: NATIVE_COMMANDS.DICTIONARY.QUERY_BY_CHINESE,
};

// Mirrors the DictionaryEntry struct returned by the `query` Rust commands in src/native/src/dictionary/.
export interface SearchEntry {
	word_id: number;
	hash: string;
	simplified: string;
	traditional: string;
	pinyin_marks: string;
	english: string[];
	measure_words: unknown[];
	notes?: string;
}
