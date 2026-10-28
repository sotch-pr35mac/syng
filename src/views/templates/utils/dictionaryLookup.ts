/**
 * Shared resolution for dictionary references in popovers and breakdown views.
 * Canonical lexical IDs preserve a referenced pronunciation/sense; text references
 * can require an exact character match. Search's broader matching policy is owned
 * separately by the search composable and is intentionally not changed here.
 */
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

/** Accept legacy text links without losing IDs, exact-match intent, or popup positioning. */
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

/** Extract display/search text without resolving the reference. */
export function getDictionaryLookupText(request: DictionaryLookupRequest): string {
	return normalizeDictionaryLookupRequest(request).text;
}

/**
 * Resolve a reference and prefer its exact spelling among results. A missing lexical
 * ID returns no entry rather than silently substituting another pronunciation/sense.
 */
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
