import { invoke } from '@tauri-apps/api/core';
import { NATIVE_COMMANDS } from '@/types/nativeCommands.js';
import type { SearchEntry } from '@/types/search.js';

export type DictionaryLookupRequest =
	| string
	| {
			text: string;
			lexicalId?: string;
			exactOnly?: boolean;
			anchor?: DOMRect;
	  };

export function normalizeDictionaryLookupRequest(request: DictionaryLookupRequest): {
	text: string;
	lexicalId?: string;
	exactOnly?: boolean;
	anchor?: DOMRect;
} {
	if (typeof request === 'string') {
		return { text: request };
	}
	return request;
}

export function getDictionaryLookupText(request: DictionaryLookupRequest): string {
	return normalizeDictionaryLookupRequest(request).text;
}

/** Resolve references consistently, independently of where the resulting entry is displayed. */
export async function lookupDictionary(
	request: DictionaryLookupRequest
): Promise<{ results: SearchEntry[]; resultIndex: number }> {
	const lookup = normalizeDictionaryLookupRequest(request);
	let results = lookup.lexicalId
		? await invoke<SearchEntry | null>(NATIVE_COMMANDS.DICTIONARY.QUERY_BY_ID, {
				id: lookup.lexicalId,
			}).then((entry) => (entry ? [entry] : []))
		: ((await invoke<SearchEntry[]>(NATIVE_COMMANDS.DICTIONARY.QUERY_BY_CHINESE, {
				text: lookup.text,
			})) ?? []);
	if (lookup.exactOnly) {
		results = results.filter(
			(row) => row.simplified === lookup.text || row.traditional === lookup.text
		);
	}
	const exactIndex = results.findIndex(
		(row) => row.simplified === lookup.text || row.traditional === lookup.text
	);
	return { results, resultIndex: Math.max(0, exactIndex) };
}
