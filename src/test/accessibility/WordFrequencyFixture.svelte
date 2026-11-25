<script lang="ts">
	import Router from 'svelte-spa-router';
	import { dictionaryDisplaySettingsStore } from '@/stores/dictionaryDisplaySettings.svelte.js';
	import MobileNavigation from '@/components/Navigation/MobileNavigation.svelte';
	import { lazyRoute } from '@/utils/lazyRoute.js';
	import Tools from '@/routes/Tools.svelte';
	import { setBookmarkManagerForTest } from '@/utils/appServices.js';
	import MobileTools from '@/routes/mobile/MobileTools.svelte';
	import { toolsSelectionStore } from '@/stores/tools.svelte.js';
	import { frequencyTool } from '@/composables/tools.svelte.js';
	setBookmarkManagerForTest({
		waitForInit: async () => undefined,
		getLists: async () => [],
		getListSummaries: async () => [
			{ name: 'Awa’s Tea Party — Sample Words', wordCount: 8 },
			{ name: 'Bookmarks', wordCount: 1 },
		],
		inList: async () => [],
	} as unknown as Parameters<typeof setBookmarkManagerForTest>[0]);
	// Test seam for changing the shared preference without remounting or reanalyzing.
	Reflect.set(window, '__setFrequencyCharacterColoring', (enabled: boolean) => {
		dictionaryDisplaySettingsStore.settings.colorCharactersByTone = enabled;
	});
	const mobile = new URLSearchParams(location.search).has('mobile');
	const routed = new URLSearchParams(location.search).has('routed');
	const routes = {
		'/study': lazyRoute(() => import('@/routes/mobile/MobileStudy.svelte')),
		'/tools': lazyRoute(() => import('@/routes/mobile/MobileTools.svelte')),
	};
	toolsSelectionStore.set(
		new URLSearchParams(location.search).has('toolbox') ? null : 'frequency'
	);
	frequencyTool.setInput('学习。学习。的。你好。天气。朋友。');
	const telemetryCalls: unknown[] = [];
	Reflect.set(window, '__syngTelemetryCalls', telemetryCalls);
	Reflect.set(window, '__TAURI_INTERNALS__', {
		invoke: async (command: string, args?: { text?: string }) => {
			if (command === 'telemetry_track_event') {
				telemetryCalls.push(args);
				return;
			}
			return command === 'analyze_word_frequency'
				? {
						chinese_characters: 11,
						unmatched_characters: 0,
						entries: ['学习', '的', '你好', '天气', '朋友'].map((text, index) => ({
							text,
							count: index === 0 ? 2 : 1,
							tones: [[2, 2], [5], [3, 3], [1, 4], [2, 5]][index],
							hsk: {
								hsk_2015: [index === 0 ? 'One' : 'Two'],
								proficiency_standard_2021: [index === 0 ? 'One' : 'Two'],
								hsk_exam_syllabus_2025: [index === 0 ? 'One' : 'Two'],
							},
						})),
					}
				: command === 'query_by_chinese'
					? [
							{
								id: '1:frequency-fixture',
								simplified: args?.text ?? '',
								traditional: args?.text ?? '',
								pinyin: { marks: 'xué xí', numbers: 'xue2xi2', tones: [2, 2] },
								commonness: 1,
								alternative_pronunciations: [],
								measure_words: [],
								english: [],
								hsk: {
									hsk_2015: [],
									proficiency_standard_2021: [],
									hsk_exam_syllabus_2025: [],
								},
							},
						]
					: [];
		},
	});
</script>

{#if routed}
	<div class="mobile-shell">
		<MobileNavigation />
		<main class="mobile"><Router {routes} /></main>
	</div>
{:else}
	<main class:mobile>
		{#if mobile}<MobileTools />{:else}<Tools />{/if}
	</main>
{/if}

<style>
	main {
		display: flex;
		height: 100vh;
	}
	main > :global(*) {
		width: 100%;
	}
	/* MobileApp's route outlet is a block, so flex shrinking must not hide overflow. */
	main.mobile {
		display: block;
		overflow: hidden;
		position: relative;
	}
	.mobile-shell {
		position: fixed;
		inset: 0;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}
	.mobile-shell main {
		flex: 1;
		height: auto;
	}
</style>
