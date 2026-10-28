<script lang="ts">
	import Router from 'svelte-spa-router';
	import MobileStudyQuiz from '@/routes/mobile/Study/MobileStudyQuiz.svelte';
	import MobileBreakdown from '@/routes/mobile/MobileBreakdown.svelte';
	import { setBookmarkManagerForTest, setPreferenceManagerForTest } from '@/utils/appServices.js';
	import { NATIVE_COMMANDS } from '@/types/nativeCommands.js';
	const words = ['不妨', '杯子', '清', '要'].map((text, i) => ({
		id: `1:${i}`,
		lexical_id: `1:${i}`,
		simplified: text,
		traditional: text,
		pinyin: { marks: ['bù fáng', 'bēi zi', 'qīng', 'yào'][i], numbers: '', tones: [1, 1] },
		english: [i === 0 ? 'there is no harm in' : i === 1 ? 'cup' : 'fixture definition'],
		measure_words: [],
		notes: '',
	}));
	let index = -1;
	const question = () => ({
		kind: 'Characters',
		question: words[index % words.length].simplified,
		lexical_unit: words[index % words.length],
		time_limit: 60,
		options: ['Answer', 'Other', 'Third', 'Fourth'].map((value) => ({ value })),
		answer: 'Answer',
	});
	Reflect.set(window, '__TAURI_INTERNALS__', {
		invoke: async (command: string, args: { text?: string }) => {
			if (command === NATIVE_COMMANDS.QUIZ.START) {
				index = -1;
				return;
			}
			if (command === NATIVE_COMMANDS.QUIZ.NEXT_QUESTION) {
				index++;
				return {
					completed: index,
					pending: 20 - index,
					question: { MultipleChoice: question() },
				};
			}
			if (command === NATIVE_COMMANDS.QUIZ.ANSWER)
				return { correct: true, question: { MultipleChoice: question() } };
			if (command === NATIVE_COMMANDS.DICTIONARY.QUERY_BY_CHINESE)
				return words.filter((w) => w.simplified === args.text);
			return [];
		},
	});
	setBookmarkManagerForTest({
		waitForInit: async () => {},
		getLists: async () => ['Review'],
		getListContent: async () => words,
		inList: async () => ['Review'],
	} as never);
	setPreferenceManagerForTest({
		waitForInit: async () => {},
		get: () => undefined,
		set: () => {},
	} as never);
	const routes = { '/study/quiz': MobileStudyQuiz, '/breakdown': MobileBreakdown };
</script>

<div class="shell">
	<div class="navigation">Study</div>
	<main><Router {routes} /></main>
</div>

<style>
	.shell {
		position: fixed;
		inset: 0;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}
	.navigation {
		height: 100px;
		flex-shrink: 0;
		padding: 1rem;
		box-sizing: border-box;
	}
	main {
		flex: 1;
		min-height: 0;
		overflow: hidden;
		position: relative;
	}
</style>
