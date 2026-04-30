import { invoke } from '@tauri-apps/api/core';
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
import { mobileCharacterWindowWordStore } from '@/stores/mobileCharacterWindowWord.svelte.js';
import { NATIVE_COMMANDS } from '@/types/nativeCommands.js';
import { handleError, resolveNameConflict, telemetry } from '@/utils';

export const DEFAULT_BOOKMARKS_LIST = 'Bookmarks';
export const CREATE_NEW_LIST_ID = 'create-new';
export const RESTRICTED_LIST_NAMES = [CREATE_NEW_LIST_ID, DEFAULT_BOOKMARKS_LIST];

const CREATE_NEW_PLACEHOLDERS = ['HSK 1', 'Week 3 Vocab', 'Internet Slang', 'Idioms', 'Chapter 7'];

type WordListPreviewItem = SyListPreviewValue & {
	active: boolean;
	sourceIndex: number;
	word: BookmarkWordEntry;
};

type WordSelection = {
	index: number;
	value?: WordListPreviewItem;
};

let activeList = $state(bookmarksActiveListStore.value);
let activeWord = $state<BookmarkWordEntry | undefined>(bookmarksActiveWordStore.value);
let words = $state<BookmarkWordEntry[]>([]);
let wordList = $state<WordListPreviewItem[]>([]);

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
		key: item.hash,
		headline:
			item.traditional === item.simplified
				? item.simplified
				: `${item.simplified} (${item.traditional})`,
		subtitle: item.pinyin_marks,
		content: item.english.join('; '),
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

function setActiveList(nextList: string): Promise<void> {
	activeList = nextList;
	bookmarksActiveListStore.set(nextList);
	clearActiveWord();
	return updateListContent();
}

function createList(name: string): Promise<boolean> {
	const newListName = name.trim();
	if (!newListName || RESTRICTED_LIST_NAMES.includes(newListName)) {
		handleError(`Cannot create new list with name ${newListName}.`);
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
				error
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
				error
			);
			return false;
		});
}

function confirmDeleteActiveList(): Promise<boolean> {
	return window.__TAURI__.dialog
		.ask(`Are you sure you want to delete ${activeList}?`, 'Delete List')
		.then((confirmed: boolean) => {
			if (confirmed) {
				return deleteActiveList();
			}
			return false;
		})
		.catch(() => false);
}

function exportActiveList(): Promise<boolean> {
	return invoke(NATIVE_COMMANDS.BOOKMARKS.EXPORT_LIST, { name: activeList, data: words })
		.then(() => {
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
			const listName = resolveNameConflict(importArchive.meta.name, bookmarksStore.lists);
			return bookmarksStore
				.createList(listName)
				.then(() => {
					const seen: Record<string, BookmarkWordInput> = {};
					for (const entry of importArchive.entries as BookmarkWordEntry[]) {
						seen[entry.hash] = { ...entry };
					}
					const entries = Object.values(seen);
					const bulkImport = entries.map((entry) =>
						bookmarksStore.addToList(listName, entry)
					);
					return Promise.all(bulkImport);
				})
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
	updateListContent,
	setActiveList,
	setActiveWord,
	selectWord,
	clearActiveWord,
	createList,
	deleteActiveList,
	confirmDeleteActiveList,
	exportActiveList,
	importList,
	getNewPlaceholder,
};
