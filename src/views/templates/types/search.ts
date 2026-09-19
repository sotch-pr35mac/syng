import { NATIVE_COMMANDS } from '@/types/nativeCommands.js';
import { lexicalDisplayId } from '@/types/dictionary.js';
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

/**
 * Create stable list keys while disambiguating repeated lexical IDs.
 *
 * Unique results keep their lexical ID unchanged so selection survives result reordering. A
 * repeated ID receives an occurrence suffix because the native text query can return the same
 * lexical unit once for each matching token span.
 */
export const searchResultKeys = (entries: readonly SearchEntry[]): string[] => {
	const occurrenceCounts = new Map<string, number>();

	return entries.map((entry) => {
		const baseKey = lexicalDisplayId(entry) || 'search-result';
		const occurrence = occurrenceCounts.get(baseKey) ?? 0;
		occurrenceCounts.set(baseKey, occurrence + 1);
		return occurrence === 0 ? baseKey : `${baseKey}-${occurrence}`;
	});
};
