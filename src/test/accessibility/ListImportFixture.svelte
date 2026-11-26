<script lang="ts">
	import ListImport from '@/components/Bookmarks/ListImport.svelte';
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import type { ImportedList, ListImportPreview, PlecoRow } from '@/types/bookmarks.js';
	import { setBookmarkManagerForTest } from '@/utils/appServices.js';
	import { mockIPC, mockWindows } from '@tauri-apps/api/mocks';
	import { emit } from '@tauri-apps/api/event';

	let visible = $state(false);
	let savedCount = $state(0);
	let openedList = $state('');
	let importedPath = $state('');
	let savedWords = $state(0);
	let savedLists: ImportedList[] = [];
	const category = 'Reading / Chapter 3 / Everyday conversations';
	const candidate = {
		id: `1:${'a'.repeat(64)}`,
		simplified: '行',
		traditional: '行',
		pinyin: { marks: 'háng' },
		english: [{ gloss: { value: 'row; line; profession; trade' } }],
	} as PlecoRow['candidates'][number];
	const row: PlecoRow = {
		line: 2,
		original: '行',
		category,
		headword: '行',
		pronunciation: '',
		definition: 'A row, line, or profession',
		candidates: [candidate],
		selected: null,
		reason: 'Choose the dictionary entry you want to save.',
	};
	const prepared: ListImportPreview = {
		format: 'pleco',
		preview: {
			file_name: 'Reading vocabulary — chapters 3 and 4.txt',
			source_format: 'text',
			rows: [
				row,
				{ ...row, category: 'Chapter 4', line: 4 },
				{
					...row,
					line: 5,
					original: '你好\tni3 hao3',
					headword: '你好',
					selected: `1:${'b'.repeat(64)}`,
					reason: null,
				},
				{
					...row,
					line: 6,
					original: 'Unmatched custom card',
					headword: 'Unmatched custom card',
					candidates: [],
					reason: 'No exact dictionary entry.',
				},
			],
		},
	};
	setBookmarkManagerForTest({
		waitForInit: async () => undefined,
		getLists: async () => savedLists.map((list) => list.name),
		importLists: async (lists: ImportedList[]) => {
			savedLists = lists;
			savedCount = lists.length;
			savedWords = lists.reduce((total, list) => total + list.lexicalIds.length, 0);
		},
	} as unknown as Parameters<typeof setBookmarkManagerForTest>[0]);
	mockIPC(
		async (command, args) => {
			if (command === 'get_hsk_lists') {
				return [
					{
						id: 'new-one',
						standard: 'hsk_exam_syllabus_2025',
						level: 'One',
						word_count: 2,
					},
					{
						id: 'new-two',
						standard: 'hsk_exam_syllabus_2025',
						level: 'Two',
						word_count: 1,
					},
					{
						id: 'new-advanced',
						standard: 'hsk_exam_syllabus_2025',
						level: 'SevenToNine',
						word_count: 3,
					},
					{ id: 'old-one', standard: 'hsk_2015', level: 'One', word_count: 2 },
				];
			}
			if (command === 'prepare_hsk_list') {
				return (args as { id: string }).id === 'new-two'
					? [candidate.id]
					: [candidate.id, `1:${'b'.repeat(64)}`];
			}
			if (command === 'prepare_list_import') {
				importedPath = (args as { path?: string } | undefined)?.path ?? 'picker';
				return prepared;
			}
			return null;
		},
		{ shouldMockEvents: true }
	);
	mockWindows('main');
	Reflect.set(window, '__LIST_IMPORT_EMIT__', emit);
</script>

<main>
	<h1>Vocabulary lists</h1>
	<SyButton onclick={() => (visible = true)}>Open import</SyButton>
	<p data-testid="saved-lists">{savedCount} lists saved</p>
	<p data-testid="opened-list">{openedList}</p>
	<p data-testid="imported-path">{importedPath}</p>
	<p data-testid="saved-words">{savedWords} words saved</p>
	<ListImport
		{visible}
		onclose={() => (visible = false)}
		onsyng={async () => true}
		onimported={async (name) => {
			openedList = name;
		}}
	/>
</main>

<style>
	main {
		padding: 1rem;
	}
</style>
