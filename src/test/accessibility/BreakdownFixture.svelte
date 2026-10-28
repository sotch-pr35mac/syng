<script lang="ts">
	import DictionaryContent from '@/components/DictionaryContent/DictionaryContent.svelte';
	import DictionaryPopover from '@/components/DictionaryPopover/DictionaryPopover.svelte';
	import MobileBreakdown from '@/routes/mobile/MobileBreakdown.svelte';
	import { setBookmarkManagerForTest } from '@/utils/appServices.js';
	import { createDictionaryPopover } from '@/composables/dictionaryPopover.svelte.js';
	import { NATIVE_COMMANDS } from '@/types/nativeCommands.js';
	import type { SearchEntry } from '@/types/search.js';
	import { onMount } from 'svelte';
	const parameters = new URLSearchParams(location.search);
	const popup = parameters.has('popup');
	const words = [parameters.get('character') || '清', '要', '语', '喷', '清清🙂'].map(
		(simplified, index) => ({
			id: `fixture-${index}`,
			simplified,
			traditional: simplified === '语' ? '語' : simplified,
			english: ['Dictionary fixture'],
			pinyin_marks: ['qīng'],
			tones_marks: [1],
			measure_words: [],
		})
	) as unknown as SearchEntry[];
	let word = $state(words[0]);
	let currentHash = $state(location.hash);
	const controller = createDictionaryPopover();
	const breakdownEvents: { name: string; payload: Record<string, unknown> }[] = [];
	Reflect.set(window, '__BREAKDOWN_EVENTS__', breakdownEvents);
	Reflect.set(window, '__TAURI_INTERNALS__', {
		invoke: async (
			command: string,
			args: { text?: string; id?: string; name?: string; payload?: Record<string, unknown> }
		) => {
			if (command === NATIVE_COMMANDS.TELEMETRY.TRACK_EVENT) {
				breakdownEvents.push({ name: args.name, payload: args.payload });
				return;
			}
			if (
				command === NATIVE_COMMANDS.DICTIONARY.QUERY_BY_ID &&
				args.id === 'classifier-hang'
			) {
				return {
					...words[0],
					id: 'classifier-hang',
					simplified: '行',
					traditional: '行',
					english: ['Referenced classifier reading'],
					pinyin_marks: ['háng'],
				};
			}
			if (command === NATIVE_COMMANDS.DICTIONARY.QUERY_BY_CHINESE && args.text === '行') {
				return [
					{
						...words[0],
						id: 'wrong-reading',
						simplified: '行',
						traditional: '行',
						english: ['Wrong homograph'],
					},
				];
			}
			if (
				command === NATIVE_COMMANDS.DICTIONARY.QUERY_BY_CHINESE &&
				['氵', '水', '青', '女', '讠', '吾', '口'].includes(args.text)
			) {
				return [
					{
						...words[0],
						id: `component-${args.text}`,
						measure_words:
							args.text === '青'
								? [
										{
											simplified: '行',
											traditional: '行',
											lexical_id: 'classifier-hang',
										},
									]
								: [],
						simplified: args.text,
						traditional: args.text,
					},
				];
			}
			if (command === NATIVE_COMMANDS.DICTIONARY.QUERY_BY_CHINESE) {
				return words.filter(
					(item) => item.simplified === args.text || item.traditional === args.text
				);
			}
			return [];
		},
	});
	setBookmarkManagerForTest({
		waitForInit: async () => undefined,
		inList: async () => [],
		getLists: async () => [],
	} as unknown as Parameters<typeof setBookmarkManagerForTest>[0]);
	onMount(() => {
		const update = () => (currentHash = location.hash);
		window.addEventListener('hashchange', update);
		return () => window.removeEventListener('hashchange', update);
	});
</script>

<main>
	<nav aria-label="Fixture words">
		{#each words as item (item.id)}<button onclick={() => (word = item)}
				>{item.simplified}</button
			>{/each}
	</nav>
	<div class="entry">
		{#if currentHash === '#/breakdown'}<MobileBreakdown />
		{:else if popup}<DictionaryPopover
				{word}
				results={[word]}
				anchor={new DOMRect(300, 60, 40, 30)}
				onclose={() => (word = undefined)}
			/>
		{:else}<DictionaryContent
				{word}
				context="page"
				onlink={controller.lookup}
			/>{/if}
	</div>
	{#if !popup}<DictionaryPopover
			word={controller.word}
			results={controller.results}
			resultIndex={controller.resultIndex}
			anchor={controller.anchor}
			onselect={controller.select}
			onclose={controller.close}
			onlink={controller.lookup}
		/>{/if}
</main>

<style>
	main {
		height: 100vh;
		display: flex;
		flex-direction: column;
	}
	nav {
		padding: 1rem;
		display: flex;
		gap: 1rem;
	}
	nav button {
		min-height: 44px;
		min-width: 44px;
	}
	.entry {
		flex: 1;
		min-height: 0;
	}
</style>
