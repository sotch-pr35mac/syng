<script lang="ts">
	import Navigation from '@/components/Navigation/Navigation.svelte';
	import DictionaryContent from '@/components/DictionaryContent/DictionaryContent.svelte';
	import StudyListItem from '@/components/StudyListItem/StudyListItem.svelte';
	import type { LexicalUnit } from '@/types/dictionary.js';
	import { setBookmarkManagerForTest, setPreferenceManagerForTest } from '@/utils/appServices.js';

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
		simplified: '西瓜',
		traditional: '西瓜',
		pinyin: { marks: 'xī guā', numbers: 'xi1 gua1', tones: [1, 1] },
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
				parts_of_speech: [],
				alternative_pronunciations: [],
				measure_words: [],
			},
		],
		hsk: {
			hsk_2015: [],
			proficiency_standard_2021: [],
			hsk_exam_syllabus_2025: ['One'],
		},
	};
</script>

<div class="shell">
	<aside><Navigation /></aside>
	<main>
		<DictionaryContent {word} lists={['Bookmarks', 'Study']} />
		<div class="study-example">
			<StudyListItem value={{ name: 'Sample words', wordCount: 4 }} />
		</div>
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
