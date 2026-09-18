import { NATIVE_COMMANDS } from '@/types/nativeCommands.js';
import type { LexicalUnit } from '@/types/dictionary.js';

export const SEARCH_LANGS = ['EN', 'PY', 'ZH'] as const;
export type SearchLang = (typeof SEARCH_LANGS)[number];

export const LANG_COMMANDS: Record<SearchLang, string> = {
	EN: NATIVE_COMMANDS.DICTIONARY.QUERY_BY_ENGLISH,
	PY: NATIVE_COMMANDS.DICTIONARY.QUERY_BY_PINYIN,
	ZH: NATIVE_COMMANDS.DICTIONARY.QUERY_BY_CHINESE,
};

// A search result is the native schema-4 lexical unit. Bookmark-only fields are intentionally
// kept separate so dictionary data is never persisted as a stale PouchDB payload.
export type SearchEntry = LexicalUnit;
