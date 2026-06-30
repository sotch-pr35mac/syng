import { invoke } from '@tauri-apps/api/core';
import { NATIVE_COMMANDS } from '@/types/nativeCommands.js';
import type { SearchEntry } from '@/types/search.js';
import { handleError } from '@/utils/index.js';

export type DictionaryPopoverController = {
	readonly word: SearchEntry | undefined;
	readonly results: SearchEntry[];
	readonly resultIndex: number;
	readonly reopenKey: number;
	lookup: (_text: string) => Promise<void>;
	select: (_index: number) => void;
	close: () => void;
};

/**
 * Shared dictionary-popover state for cross-reference links (e.g. measure words) tapped inside
 * a DictionaryContent. The quiz and flashcards routes previously each held an identical copy of
 * this state; this factory consolidates it. `reopenKey` is bumped on every lookup so a mobile
 * snap sheet can re-pop to partial when a new word is tapped while it's already open (see
 * SySnapSheet); paging through senses with the result arrows does not bump it.
 */
export function createDictionaryPopover(): DictionaryPopoverController {
	let results = $state<SearchEntry[]>([]);
	let resultIndex = $state(0);
	let word = $state<SearchEntry | undefined>(undefined);
	let reopenKey = $state(0);

	async function lookup(text: string): Promise<void> {
		try {
			const found = await invoke<SearchEntry[]>(NATIVE_COMMANDS.DICTIONARY.QUERY_BY_CHINESE, {
				text,
			});
			if (!found.length) {
				return;
			}
			const exactMatchIndex = found.findIndex(
				(result) => result.simplified === text || result.traditional === text
			);
			results = found;
			resultIndex = exactMatchIndex >= 0 ? exactMatchIndex : 0;
			word = results[resultIndex];
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
		lookup,
		select,
		close,
	};
}
