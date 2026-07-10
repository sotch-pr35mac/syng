import { invoke } from '@tauri-apps/api/core';
import { NATIVE_COMMANDS } from '@/types/nativeCommands.js';
import type { SearchEntry } from '@/types/search.js';
import { handleError } from '@/utils/index.js';

export type DictionaryLookupRequest =
	| string
	| {
			text: string;
			anchor?: DOMRect;
	  };

export type DictionaryPopoverController = {
	readonly word: SearchEntry | undefined;
	readonly results: SearchEntry[];
	readonly resultIndex: number;
	readonly reopenKey: number;
	readonly anchor: DOMRect | undefined;
	lookup: (_request: DictionaryLookupRequest) => Promise<void>;
	select: (_index: number) => void;
	close: () => void;
};

export function normalizeDictionaryLookupRequest(request: DictionaryLookupRequest): {
	text: string;
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

/**
 * Shared dictionary-popover state for cross-reference links (e.g. measure words) tapped inside
 * a DictionaryContent. `reopenKey` is bumped on every lookup so a mobile snap sheet can re-pop to
 * partial when a new word is tapped while it's already open (see SySnapSheet); paging through
 * senses with the result arrows does not bump it.
 */
export function createDictionaryPopover(): DictionaryPopoverController {
	let results = $state<SearchEntry[]>([]);
	let resultIndex = $state(0);
	let word = $state<SearchEntry | undefined>(undefined);
	let reopenKey = $state(0);
	let anchor = $state<DOMRect | undefined>(undefined);

	async function lookup(request: DictionaryLookupRequest): Promise<void> {
		const lookup = normalizeDictionaryLookupRequest(request);
		try {
			const found = await invoke<SearchEntry[]>(NATIVE_COMMANDS.DICTIONARY.QUERY_BY_CHINESE, {
				text: lookup.text,
			});
			if (!found.length) {
				return;
			}
			const exactMatchIndex = found.findIndex(
				(result) => result.simplified === lookup.text || result.traditional === lookup.text
			);
			results = found;
			resultIndex = exactMatchIndex >= 0 ? exactMatchIndex : 0;
			word = results[resultIndex];
			if (lookup.anchor) {
				anchor = lookup.anchor;
			}
			reopenKey += 1;
		} catch (error) {
			handleError('There was an error looking up the dictionary word.', error);
		}
	}

	function select(index: number): void {
		resultIndex = index;
		word = results[index];
	}

	function close(): void {
		word = undefined;
		results = [];
		resultIndex = 0;
		anchor = undefined;
	}

	return {
		get word() {
			return word;
		},
		get results() {
			return results;
		},
		get resultIndex() {
			return resultIndex;
		},
		get reopenKey() {
			return reopenKey;
		},
		get anchor() {
			return anchor;
		},
		lookup,
		select,
		close,
	};
}
