<script lang="ts">
	import { onMount } from 'svelte';
	import WalkthroughHost from '@/components/Walkthrough/WalkthroughHost.svelte';
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import { walkthroughStore } from '@/stores/walkthrough.svelte.js';
	import { walkthroughTarget } from '@/actions/walkthroughTarget.svelte.js';
	import {
		setBookmarkManagerForTest,
		setPreferenceManagerForTest,
		setReaderDocumentManagerForTest,
	} from '@/utils/appServices.js';
	import { createPlainTextReaderImportPayload } from '@/utils/readerDocument.js';
	import type { ReaderDocument, ReaderImportPayload } from '@/types/reader.js';
	import type { BookmarkWordEntry } from '@/stores/bookmarks.svelte.js';
	import { createWalkthroughPreferences } from '@/types/walkthrough.js';
	import Navigation from '@/components/Navigation/Navigation.svelte';
	import MobileNavigation from '@/components/Navigation/MobileNavigation.svelte';
	import Study from '@/routes/Study.svelte';
	import MobileStudy from '@/routes/mobile/MobileStudy.svelte';

	const parameters = new URLSearchParams(location.search);
	const vocabulary = parameters.has('vocabulary');
	const overviewStudy = parameters.has('overviewStudy');
	const mobile = parameters.has('mobile');
	const preferences: Record<string, unknown> = {
		walkthrough: {
			...createWalkthroughPreferences(),
			guides: overviewStudy
				? { app: { status: 'in-progress', stepId: 'study', context: {} } }
				: {},
		},
	};
	const documents: ReaderDocument[] = [];
	const lists: Record<string, BookmarkWordEntry[]> = { Bookmarks: [] };
	setPreferenceManagerForTest({
		waitForInit: async () => undefined,
		get: (key: string) => preferences[key],
		set: (key: string, value: unknown) => {
			preferences[key] = value;
		},
	} as unknown as Parameters<typeof setPreferenceManagerForTest>[0]);
	setReaderDocumentManagerForTest({
		waitForInit: async () => undefined,
		getDocuments: async () => documents,
		createDocument: async (payload: ReaderImportPayload) => {
			const document = { ...payload, _id: 'sample-document' } as ReaderDocument;
			documents.push(document);
			return document;
		},
	} as unknown as Parameters<typeof setReaderDocumentManagerForTest>[0]);
	setBookmarkManagerForTest({
		waitForInit: async () => undefined,
		getLists: async () => Object.keys(lists),
		getListContent: async (name: string) => lists[name] ?? [],
		getListSummaries: async () =>
			Object.entries(lists).map(([name, words]) => ({ name, wordCount: words.length })),
		createList: async (name: string) => {
			lists[name] = [];
		},
		addToList: async (name: string, entry: { lexical_id: string }) => {
			lists[name].push({
				...word(entry.lexical_id.slice(2)),
				lexical_id: entry.lexical_id,
			} as BookmarkWordEntry);
		},
	} as unknown as Parameters<typeof setBookmarkManagerForTest>[0]);

	function word(text: string) {
		return {
			id: `1:${text}`,
			simplified: text,
			traditional: text,
			pinyin: { marks: '', numbers: '', tones: [] },
			english: [],
		};
	}

	Reflect.set(window, '__TAURI_INTERNALS__', {
		invoke: async (
			command: string,
			parameters: { text: string; args: { text: string; title: string } }
		) => {
			if (command === 'prepare_reader_import') {
				return createPlainTextReaderImportPayload(
					parameters.args.title,
					parameters.args.text
				);
			}
			if (command === 'query_by_chinese') {
				return [word(parameters.text)];
			}
			return [];
		},
	});
	onMount(() => {
		void walkthroughStore.start(
			overviewStudy ? 'app' : vocabulary ? 'study' : 'reader-library',
			{},
			overviewStudy
		);
		return () => walkthroughStore.interrupt();
	});
</script>

{#if overviewStudy}
	<div class="overview-shell" class:mobile>
		{#if mobile}
			<MobileNavigation />
		{:else}
			<aside><Navigation /></aside>
		{/if}
		<div class="overview-content">
			{#if mobile}<MobileStudy />{:else}<Study />{/if}
		</div>
	</div>
{:else}
	<main>
		<h1>{vocabulary ? 'Study' : 'Reader'}</h1>
		{#if vocabulary}
			<div use:walkthroughTarget={'study-lists'}>Your vocabulary lists</div>
		{:else}
			<SyButton guideTarget="reader-import">Import</SyButton>
			<div use:walkthroughTarget={'reader-library'}>Your Reader library</div>
		{/if}
	</main>
{/if}
<WalkthroughHost />

<style>
	.overview-shell {
		display: flex;
		height: 100vh;
	}
	.overview-shell.mobile {
		flex-direction: column;
	}
	aside {
		width: 92px;
		flex-shrink: 0;
	}
	.overview-content {
		display: flex;
		flex: 1;
		min-width: 0;
		min-height: 0;
	}
	.mobile .overview-content {
		display: block;
	}
	main {
		padding: 24px;
		font-family: var(--sy-font-family);
		color: var(--sy-color--black);
	}
</style>
