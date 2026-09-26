import { invoke } from '@tauri-apps/api/core';
import { ask } from '@tauri-apps/plugin-dialog';
import { Plus } from 'lucide-svelte';
import DividerDropdownItem from '@/components/SyDropdown/DividerDropdownItem.svelte';
import SimpleTextDropdownItem from '@/components/SyDropdown/SimpleTextDropdownItem.svelte';
import TextWithIconDropdownItem from '@/components/SyDropdown/TextWithIconDropdownItem.svelte';
import type { SyListPreviewValue } from '@/components/SyList/SyListPreview.types.js';
import {
	bookmarksStore,
	type BookmarkWordEntry,
	type BookmarkWordInput,
} from '@/stores/bookmarks.svelte.js';
import {
	bookmarksActiveListStore,
	bookmarksActiveWordStore,
} from '@/stores/bookmarksRoute.svelte.js';
import {
	normalizeDictionaryLookupRequest,
	type DictionaryLookupRequest,
} from '@/composables/dictionaryPopover.svelte.js';
import { mobileCharacterWindowWordStore } from '@/stores/mobileCharacterWindowWord.svelte.js';
import { bookmarkRecoveryStore } from '@/stores/bookmarkRecovery.svelte.js';
import { NATIVE_COMMANDS } from '@/types/nativeCommands.js';
import type { SearchEntry } from '@/types/search.js';
import { lexicalDisplayId, lexicalGlosses, lexicalPinyin } from '@/types/dictionary.js';
import {
	BOOKMARK_LIST_MEMBERSHIP_OPERATIONS,
	type BookmarkListMembershipEvent,
} from '@/types/bookmarks.js';
import { handleError, resolveNameConflict, telemetry } from '@/utils';

export const DEFAULT_BOOKMARKS_LIST = 'Bookmarks';
export const CREATE_NEW_LIST_ID = 'create-new';
export const RESTRICTED_LIST_NAMES = [CREATE_NEW_LIST_ID, DEFAULT_BOOKMARKS_LIST];

const CREATE_NEW_PLACEHOLDERS = ['HSK 1', 'Week 3 Vocab', 'Internet Slang', 'Idioms', 'Chapter 7'];

export type WordListPreviewItem = SyListPreviewValue & {
	active: boolean;
	sourceIndex: number;
	word: BookmarkWordEntry;
};

type WordSelection = {
	index: number;
	visibleIndex?: number;
	visibleCount?: number;
	value?: WordListPreviewItem;
};

export type MembershipReconciliation = {
	clearFilter: boolean;
};

let activeList = $state(bookmarksActiveListStore.value);
let activeWord = $state<BookmarkWordEntry | undefined>(bookmarksActiveWordStore.value);
let words = $state<BookmarkWordEntry[]>([]);
let wordList = $state<WordListPreviewItem[]>([]);
let popoverResults = $state<SearchEntry[]>([]);
let popoverResultIndex = $state(0);
let popoverRequest = 0;
let popoverWord = $state<SearchEntry | undefined>(undefined);
let popoverAnchor = $state<DOMRect | undefined>(undefined);

function getDropdownList() {
	return [
		...bookmarksStore.lists
			.map((listName) => ({
				text: listName,
				id: listName,
				component: SimpleTextDropdownItem,
			}))
			.sort((listA, listB) => listA.text.localeCompare(listB.text)),
		{
			component: DividerDropdownItem,
		},
		{
			text: 'Create New',
			id: CREATE_NEW_LIST_ID,
			component: TextWithIconDropdownItem,
			icon: Plus,
			color: 'blue',
			hover: 'green',
		},
	];
}

function formatWordList(items: BookmarkWordEntry[]): WordListPreviewItem[] {
	return items.map((item, index) => ({
		key: lexicalDisplayId(item),
		headline:
			item.traditional === item.simplified
				? item.simplified
				: `${item.simplified} (${item.traditional})`,
		subtitle: lexicalPinyin(item).marks,
		content: lexicalGlosses(item).join('; '),
		active: false,
		sourceIndex: index,
		word: item,
	}));
}

function clearActiveWord(): void {
	activeWord = undefined;
	bookmarksActiveWordStore.set(undefined);
	mobileCharacterWindowWordStore.set(undefined);
}

function setActiveWord(word: BookmarkWordEntry | undefined): void {
	activeWord = word;
	bookmarksActiveWordStore.set(word);
	mobileCharacterWindowWordStore.set(word);
}

function selectWord(selection: WordSelection): BookmarkWordEntry | undefined {
	const selectedWord =
		selection.value?.word ?? words[selection.value?.sourceIndex ?? selection.index];
	setActiveWord(selectedWord);
	if (selectedWord) {
		telemetry
			.trackEvent('dictionary.word_opened', {
				source: 'bookmarks',
				interaction: 'list',
				result_position: (selection.visibleIndex ?? selection.index) + 1,
				result_count: selection.visibleCount ?? wordList.length,
			})
			.catch(() => {});
	}
	return selectedWord;
}

function updateListContent(): Promise<void> {
	return bookmarksStore
		.getContent(activeList)
		.then((activeListWords) => {
			words = activeListWords;
			wordList = formatWordList(activeListWords);
			return undefined;
		})
		.catch((error) => {
			handleError(
				'There was an error fetching the word list content. Check the logs for more details.',
				error
			);
		});
}

function getAdjacentLexicalId(
	items: WordListPreviewItem[],
	removedLexicalId: string
): string | undefined {
	const wordIdentity = (word: BookmarkWordEntry): string => word.lexical_id;
	const removedVisibleIndex = items.findIndex(
		(item) => wordIdentity(item.word) === removedLexicalId
	);
	if (removedVisibleIndex >= 0) {
		return (
			(items[removedVisibleIndex + 1]
				? wordIdentity(items[removedVisibleIndex + 1].word)
				: undefined) ??
			(items[removedVisibleIndex - 1]
				? wordIdentity(items[removedVisibleIndex - 1].word)
				: undefined)
		);
	}

	const removedSourceIndex = words.findIndex((word) => wordIdentity(word) === removedLexicalId);
	if (removedSourceIndex < 0) {
		return items[0] ? wordIdentity(items[0].word) : undefined;
	}

	const nextVisibleWord = items.find((item) => item.sourceIndex > removedSourceIndex);
	if (nextVisibleWord) {
		return wordIdentity(nextVisibleWord.word);
	}
	const previousVisibleWord = [...items]
		.reverse()
		.find((item) => item.sourceIndex < removedSourceIndex);
	return previousVisibleWord ? wordIdentity(previousVisibleWord.word) : undefined;
}

async function reconcileMembershipChange(
	event: BookmarkListMembershipEvent,
	visibleItems: WordListPreviewItem[]
): Promise<MembershipReconciliation> {
	if (event.listName !== activeList) {
		return { clearFilter: false };
	}

	const eventLexicalId = event.lexicalId;
	if (!eventLexicalId) {
		return { clearFilter: false };
	}
	const selectedLexicalId = activeWord?.lexical_id;
	const selectedWordWasRemoved =
		event.operation === BOOKMARK_LIST_MEMBERSHIP_OPERATIONS.REMOVED &&
		selectedLexicalId === eventLexicalId;
	const removedSourceIndex = words.findIndex((word) => word.lexical_id === eventLexicalId);
	const visibleAdjacentLexicalId = selectedWordWasRemoved
		? getAdjacentLexicalId(visibleItems, eventLexicalId)
		: undefined;

	await updateListContent();

	if (!selectedWordWasRemoved) {
		if (selectedLexicalId) {
			const refreshedActiveWord = words.find((word) => word.lexical_id === selectedLexicalId);
			if (refreshedActiveWord) {
				setActiveWord(refreshedActiveWord);
			}
		}
		return { clearFilter: false };
	}

	const visibleAdjacentWord = words.find((word) => word.lexical_id === visibleAdjacentLexicalId);
	if (visibleAdjacentWord) {
		setActiveWord(visibleAdjacentWord);
		return { clearFilter: false };
	}

	if (!words.length) {
		clearActiveWord();
		return { clearFilter: true };
	}

	const fallbackIndex = Math.min(Math.max(removedSourceIndex, 0), words.length - 1);
	setActiveWord(words[fallbackIndex]);
	return { clearFilter: true };
}

function setActiveList(nextList: string): Promise<void> {
	activeList = nextList;
	bookmarksActiveListStore.set(nextList);
	clearActiveWord();
	return updateListContent();
}

function createList(name: string): Promise<boolean> {
	const newListName = name.trim();
	if (!newListName || RESTRICTED_LIST_NAMES.includes(newListName)) {
		handleError(
			`Cannot create new list with name ${newListName}.`,
			{ list: newListName },
			{ telemetryMessage: 'Cannot create list with this name.' }
		);
		return Promise.resolve(false);
	}

	return bookmarksStore
		.createList(newListName)
		.then(() => {
			telemetry.trackEvent('list.created', {}).catch(() => {});
			return true;
		})
		.catch((error: unknown) => {
			handleError(
				`There was an unexpected error while attempting to create the list ${newListName}. Check the log for more details.`,
				error,
				{ telemetryMessage: 'List creation failed.', privateValues: [newListName] }
			);
			return false;
		});
}

function deleteActiveList(): Promise<boolean> {
	const listToDelete = activeList;
	return bookmarksStore
		.deleteList(listToDelete)
		.then(() => {
			telemetry.trackEvent('list.deleted', {}).catch(() => {});
			return setActiveList(DEFAULT_BOOKMARKS_LIST).then(() => true);
		})
		.catch((error: unknown) => {
			handleError(
				`There was an unexpected error deleting the list ${listToDelete}. Please check the log for more details.`,
				error,
				{ telemetryMessage: 'List deletion failed.', privateValues: [listToDelete] }
			);
			return false;
		});
}

function confirmDeleteActiveList(): Promise<boolean> {
	return ask(`Are you sure you want to delete ${activeList}?`, { title: 'Delete List' })
		.then((confirmed: boolean) => {
			if (confirmed) {
				return deleteActiveList();
			}
			return false;
		})
		.catch(() => false);
}

function exportActiveList(): Promise<boolean> {
	return invoke<boolean>(NATIVE_COMMANDS.BOOKMARKS.EXPORT_LIST, { name: activeList, data: words })
		.then((saved) => {
			if (!saved) {
				return false;
			}
			telemetry.trackEvent('list.exported', {}).catch(() => {});
			return true;
		})
		.catch((error: unknown) => {
			handleError(
				'There was an error exporting your list. Check the log for more details.',
				error
			);
			return false;
		});
}

function importList(): Promise<boolean> {
	return invoke<any>(NATIVE_COMMANDS.BOOKMARKS.IMPORT_LIST)
		.then((importArchive) => {
			if (!importArchive) {
				return false;
			}
			if (
				typeof importArchive.recovery_report === 'string' &&
				importArchive.recovery_report
			) {
				bookmarkRecoveryStore.show(importArchive.recovery_report);
			}
			const listName = resolveNameConflict(importArchive.meta.name, bookmarksStore.lists);
			return bookmarksStore
				.createList(listName)
				.then(() => {
					const seen: Record<string, BookmarkWordInput> = {};
					for (const entry of importArchive.entries as BookmarkWordInput[]) {
						seen[entry.lexical_id] = {
							lexical_id: entry.lexical_id,
							...(typeof entry.notes === 'string' ? { notes: entry.notes } : {}),
						};
					}
					const entries = Object.values(seen);
					const bulkImport = entries.map((entry) =>
						bookmarksStore.addToList(listName, entry)
					);
					return Promise.all(bulkImport);
				})
				.then(() => setActiveList(listName))
				.then(() => {
					telemetry.trackEvent('list.imported', {}).catch(() => {});
					return true;
				})
				.catch((error: unknown) => {
					handleError(
						'There was an error importing the list. Check the log for more details.',
						error
					);
					return false;
				});
		})
		.catch((error: unknown) => {
			handleError(
				'There was an error importing the list. Check the log for more details.',
				error
			);
			return false;
		});
}

async function openPopoverDictionary(text: string, anchor: DOMRect): Promise<void> {
	await lookupPopoverWord({ text, anchor });
}

async function lookupPopoverWord(request: DictionaryLookupRequest): Promise<void> {
	const lookup = normalizeDictionaryLookupRequest(request);
	const requestId = ++popoverRequest;
	try {
		const results = lookup.lexicalId
			? await invoke<SearchEntry | null>(NATIVE_COMMANDS.DICTIONARY.QUERY_BY_ID, {
					id: lookup.lexicalId,
				}).then((unit) => (unit ? [unit] : []))
			: await invoke<SearchEntry[]>(NATIVE_COMMANDS.DICTIONARY.QUERY_BY_CHINESE, {
					text: lookup.text,
				});
		if (requestId !== popoverRequest || !results.length) {
			return;
		}
		const exactMatchIndex = results.findIndex(
			(result) => result.simplified === lookup.text || result.traditional === lookup.text
		);
		popoverResults = results;
		popoverResultIndex = exactMatchIndex >= 0 ? exactMatchIndex : 0;
		popoverWord = popoverResults[popoverResultIndex];
		if (lookup.anchor) {
			popoverAnchor = lookup.anchor;
		}
		telemetry
			.trackEvent('dictionary.word_opened', { source: 'bookmarks', interaction: 'link' })
			.catch(() => {});
	} catch (error) {
		handleError('There was an error looking up the dictionary word.', error);
	}
}

function selectPopoverResult(index: number): void {
	if (!popoverResults[index] || index === popoverResultIndex) {
		return;
	}
	popoverResultIndex = index;
	popoverWord = popoverResults[index];
	telemetry
		.trackEvent('dictionary.word_opened', {
			source: 'bookmarks',
			interaction: 'popover_result',
			result_position: index + 1,
			result_count: popoverResults.length,
		})
		.catch(() => {});
}

function closePopoverDictionary(): void {
	popoverRequest += 1;
	popoverWord = undefined;
	popoverResults = [];
	popoverResultIndex = 0;
	popoverAnchor = undefined;
}

function getNewPlaceholder(): string {
	return CREATE_NEW_PLACEHOLDERS[Math.floor(Math.random() * CREATE_NEW_PLACEHOLDERS.length)];
}

export const bookmarksRoute = {
	get activeList(): string {
		return activeList;
	},
	get activeWord(): BookmarkWordEntry | undefined {
		return activeWord;
	},
	get lists(): string[] {
		return bookmarksStore.lists;
	},
	get dropdownList() {
		return getDropdownList();
	},
	get words(): BookmarkWordEntry[] {
		return words;
	},
	get wordList(): WordListPreviewItem[] {
		return wordList;
	},
	get popoverWord(): SearchEntry | undefined {
		return popoverWord;
	},
	get popoverResults(): SearchEntry[] {
		return popoverResults;
	},
	get popoverResultIndex(): number {
		return popoverResultIndex;
	},
	get popoverAnchor(): DOMRect | undefined {
		return popoverAnchor;
	},
	updateListContent,
	setActiveList,
	setActiveWord,
	selectWord,
	reconcileMembershipChange,
	clearActiveWord,
	createList,
	deleteActiveList,
	confirmDeleteActiveList,
	exportActiveList,
	importList,
	getNewPlaceholder,
	openPopoverDictionary,
	lookupPopoverWord,
	selectPopoverResult,
	closePopoverDictionary,
};
