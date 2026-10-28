<script lang="ts">
	import Document from '@/routes/Reader/Document.svelte';
	import MobileReaderDocument from '@/routes/mobile/Reader/MobileReaderDocument.svelte';
	import Flashcards from '@/routes/Study/Flashcards.svelte';
	import MobileStudyFlashcards from '@/routes/mobile/Study/MobileStudyFlashcards.svelte';
	import MobileCharacters from '@/routes/mobile/MobileCharacters.svelte';
	import PinyinSettings from '@/components/SettingsOption/PinyinSettings.svelte';
	import {
		setPreferenceManagerForTest,
		setBookmarkManagerForTest,
		setReaderDocumentManagerForTest,
	} from '@/utils/appServices.js';
	import { pinyinSettingsStore } from '@/stores/pinyinSettings.svelte.js';
	import { readerSettingsStore } from '@/stores/readerSettings.svelte.js';
	import { dictionaryDisplaySettingsStore } from '@/stores/dictionaryDisplaySettings.svelte.js';
	import { mobileCharacterWindowWordStore } from '@/stores/mobileCharacterWindowWord.svelte.js';
	import { bookmarksStore } from '@/stores/bookmarks.svelte.js';
	import { readerRoute } from '@/composables/reader.svelte.js';
	import { createPlainTextReaderImportPayload } from '@/utils/readerDocument.js';
	import { DEFAULT_READER_SETTINGS } from '@/utils/readerSettings.js';
	import type { ReaderDocument } from '@/types/reader.js';
	import type { LexicalUnit } from '@/types/dictionary.js';
	import '@/styles/tones.css';
	const parameters = new URLSearchParams(location.search);
	const surface = parameters.get('pinyin') ?? 'reader';
	const mobile = parameters.has('mobile');
	const word = {
		id: '1:fixture',
		simplified: '学习',
		traditional: '學習',
		pinyin: { marks: 'xué xí', numbers: 'xue2xi2', tones: [2, 2] },
		english: ['to learn'],
		hsk: {},
		measure_words: [],
		alternative_pronunciations: [],
	} as unknown as LexicalUnit;
	const preferences: Record<string, unknown> = JSON.parse(
		localStorage.getItem('fixture:pinyin') ?? '{}'
	);
	preferences.readerSettings ??= {
		...DEFAULT_READER_SETTINGS,
		colorTheme: parameters.get('theme') ?? 'automatic',
	};
	preferences.colorPinyinByTone = parameters.has('colors');
	preferences.characterSet = 'both';
	setPreferenceManagerForTest({
		waitForInit: async () => undefined,
		get: (key: string) => preferences[key],
		set: (key: string, value: unknown) => {
			preferences[key] = value;
			localStorage.setItem('fixture:pinyin', JSON.stringify(preferences));
		},
	} as unknown as Parameters<typeof setPreferenceManagerForTest>[0]);
	const nativeStory = parameters.has('nativeStory');
	const text = nativeStory
		? [
				'阿瓦第一次来昆明。',
				'今天早上，天气很好。天很蓝，也不冷。阿瓦吃完早饭，想出去走一走。',
				'他走在路上，看见很多人，也看见很多树。路边有小店，有卖水果的，也有卖花的。阿瓦觉得这里很漂亮。',
				'走了一会儿，他有一点饿了。',
			]
				.join('\n\n')
				.repeat(10)
		: '学习中文，每天阅读。你好世界！Hello 🙂。\n\n'.repeat(50);
	const initialBook = {
		...createPlainTextReaderImportPayload('Pinyin reading', text),
		_id: 'pinyin-book',
		imported_at: '',
		updated_at: '',
		reading_order: [],
		progress: { position: 0 },
	} as unknown as ReaderDocument;
	if (parameters.has('complex')) {
		initialBook.blocks[0].kind = 'heading';
		initialBook.blocks[0].heading_level = 2;
		initialBook.blocks.splice(1, 0, {
			id: 'table',
			kind: 'table',
			text: '',
			participates_in_linear_text: false,
			extensions: {
				table: {
					rows: [
						{ cells: [{ text: '学习中文' }, { text: '你好世界' }] },
						{ cells: [{ text: '每天阅读' }, { text: '学习中文' }] },
					],
				},
			},
		});
	}
	if (nativeStory) {
		// Rust serializes absent block annotations as null, unlike the JS import helper.
		for (const block of initialBook.blocks) block.spans = null;
	}
	if (!nativeStory && initialBook.blocks[0])
		initialBook.blocks[0].spans = [
			{ start: 0, end: 2, style: 'ruby', annotation: 'author reading' },
		];
	if (parameters.has('regressions')) {
		const prose =
			'我的工作聚焦于人与产品、技术的交汇处。我是一名创始工程师和技术负责人，拥有丰富的\n对话式 AI 产品、生产级自然语言处理系统以及跨平台软件开发经验。我曾带领工程团队，\n交付面向客户的 AI 系统，同时始终深度参与系统架构、工程实现、基础设施和产品开发的\n各个环节。我尤其关注语言、语音以及 AI 技术的实际应用。';
		initialBook.text = prose + '\n\n学习中文，每天阅读。';
		initialBook.blocks = [
			{
				id: 'prose',
				kind: 'paragraph',
				text: prose,
				start_offset: 0,
				end_offset: prose.length,
			},
			{
				id: 'ruby',
				kind: 'paragraph',
				text: '学习中文，每天阅读。',
				start_offset: prose.length + 2,
				end_offset: initialBook.text.length,
				spans: [{ start: 0, end: 4, style: 'ruby', annotation: 'xué xí zhōng wén' }],
				extensions: { block_style: { text_indent: '2em' } },
			},
			{
				id: 'table',
				kind: 'table',
				text: '',
				participates_in_linear_text: false,
				extensions: {
					table: {
						rows: [
							{ cells: [{ text: '' }, { text: '学习' }] },
							{ cells: [{ text: '' }, { text: '' }] },
							{ cells: [{ text: '中文' }, { text: '' }] },
						],
					},
				},
			},
		];
	}
	let book = $state(initialBook);
	setReaderDocumentManagerForTest({
		waitForInit: async () => undefined,
		getDocuments: async () => [book],
		getDocument: async () => book,
		updateProgress: async (_id: string, progress: ReaderDocument['progress']) => {
			book = { ...book, progress };
			return book;
		},
	} as unknown as Parameters<typeof setReaderDocumentManagerForTest>[0]);
	setBookmarkManagerForTest({
		waitForInit: async () => undefined,
		getLists: async () => ['Pinyin'],
		getListContent: async () => [word, { ...word, id: '1:second' }],
		inList: async () => ['Pinyin'],
	} as unknown as Parameters<typeof setBookmarkManagerForTest>[0]);
	Reflect.set(window, '__TAURI_INTERNALS__', {
		invoke: async (command: string, args?: { text?: string; includePinyin?: boolean }) => {
			if (command === 'tokenize_reader_text')
				return Array.from(
					(args?.text ?? '').matchAll(/[\u3400-\u9fff]{1,2}/g),
					(match) => ({
						text: match[0],
						start: match.index!,
						end: match.index! + match[0].length,
						...(args?.includePinyin
							? {
									pinyin:
										match[0] === '学习'
											? word.pinyin
											: {
													marks: 'zhōng wén',
													numbers: 'zhong1wen2',
													tones: [1, 2],
												},
								}
							: {}),
					})
				);
			if (command === 'query_by_chinese') {
				Reflect.set(window, '__pinyinLookup', args?.text);
				return [word];
			}
			if (command === 'plugin:app|version') return '2.6.0';
			return null;
		},
	});
	// Expose observables only; tests drive the actual controls.
	Reflect.set(window, '__pinyinReadingPosition', () => readerRoute.currentPage?.start);
	Reflect.set(window, '__pinyinCurrentPage', () => readerRoute.currentPage);
	Reflect.set(window, '__pinyinSourceBlocks', () => initialBook.blocks);
	let ready = $state(false);
	void Promise.all([
		pinyinSettingsStore.loadSettings(),
		readerSettingsStore.loadSettings(),
		dictionaryDisplaySettingsStore.loadSettings(),
		bookmarksStore.refresh(),
	]).then(() => {
		mobileCharacterWindowWordStore.set(word);
		window.location.hash =
			surface === 'flashcards'
				? '#/study/flashcards?list=Pinyin'
				: surface === 'reader'
					? '#/read/document/pinyin-book'
					: '#/characters';
		ready = true;
	});
</script>

{#if ready}
	<div class="fixture">
		<details><summary>Test preferences</summary><PinyinSettings /></details>
		<main>
			{#if surface === 'reader'}
				{#if mobile}<MobileReaderDocument params={{ id: book._id }} />{:else}<Document
						params={{ id: book._id }}
					/>{/if}
			{:else if surface === 'flashcards'}
				{#if mobile}<MobileStudyFlashcards />{:else}<Flashcards />{/if}
			{:else}<MobileCharacters />{/if}
		</main>
	</div>
{/if}

<style>
	.fixture {
		height: 100vh;
		display: flex;
		flex-direction: column;
	}
	details {
		padding: 8px 16px;
		border-bottom: 1px solid #aaa;
		background: var(--sy-color--white);
	}
	main {
		min-height: 0;
		flex: 1;
		position: relative;
	}
</style>
