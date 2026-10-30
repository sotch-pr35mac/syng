<script lang="ts">
	import Navigation from '@/components/Navigation/Navigation.svelte';
	import DictionaryContent from '@/components/DictionaryContent/DictionaryContent.svelte';
	import StudyListItem from '@/components/StudyListItem/StudyListItem.svelte';
	import type { LexicalUnit } from '@/types/dictionary.js';
	import { setBookmarkManagerForTest, setPreferenceManagerForTest } from '@/utils/appServices.js';

	const parameters = new URLSearchParams(location.search);
	const headerCase = parameters.has('dictionaryHeader');
	setPreferenceManagerForTest({
		waitForInit: async () => undefined,
		get: () => false,
	} as unknown as Parameters<typeof setPreferenceManagerForTest>[0]);
	setBookmarkManagerForTest({
		waitForInit: async () => undefined,
		inList: async () => [],
	} as unknown as Parameters<typeof setBookmarkManagerForTest>[0]);
	const word: LexicalUnit = {
		id: '1:西瓜',
		simplified: parameters.get('characters') ?? '西瓜',
		traditional: parameters.get('traditional') ?? parameters.get('characters') ?? '西瓜',
		pinyin: {
			marks: parameters.get('pinyinText') ?? 'xī guā',
			numbers: 'xi1 gua1',
			tones: [1, 1],
		},
		commonness: 0,
		alternative_pronunciations: [],
		measure_words: [],
		english: [
			{
				gloss: { value: 'watermelon', sources: ['cc-cedict'] },
				examples: [],
				commentary: [],
				qualifiers: [],
				lexical_kinds: [],
				parts_of_speech:
					headerCase && !parameters.has('noTags')
						? (
								[
									'noun',
									'verb',
									'adjective',
									'onomatopoeia',
									'interrogative-pronoun',
								] as const
							).map((value) => ({ value, sources: ['cc-cedict'] }))
						: [],
				alternative_pronunciations: [],
				measure_words: [],
			},
		],
		hsk: {
			hsk_2015: [],
			proficiency_standard_2021: [],
			hsk_exam_syllabus_2025: parameters.has('noTags') ? [] : ['One'],
		},
	};
</script>

<div class="shell">
	{#if !headerCase}<aside><Navigation /></aside>{/if}
	<main>
		<DictionaryContent
			{word}
			lists={parameters.has('singleList') ? ['Bookmarks'] : ['Bookmarks', 'Study']}
		/>
		{#if !headerCase}
			<div class="study-example">
				<StudyListItem value={{ name: 'Sample words', wordCount: 4 }} />
			</div>
		{/if}
	</main>
</div>

<style>
	.shell {
		display: flex;
		height: 100vh;
	}
	aside {
		width: 92px;
		flex-shrink: 0;
	}
	main {
		flex: 1;
		min-width: 0;
	}
	.study-example {
		position: absolute;
		bottom: 120px;
		left: 160px;
		width: 400px;
	}
</style>
