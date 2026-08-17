<!-- Colors dictionary-backed pinyin segments using native word_data tone metadata. -->
<script lang="ts">
	import type { PinyinSegment } from '@/types/tools.js';
	import ColorizedPinyinSyllables from '@/components/ColorizedText/ColorizedPinyinSyllables.svelte';

	interface Props {
		segments?: PinyinSegment[];
	}

	const { segments = [] }: Props = $props();
	const SPACE = ' ';
</script>

<span
	>{#each segments as segment, segmentIndex (segmentIndex)}{#if segment.word_data}{#if segmentIndex > 0 && segments[segmentIndex - 1].word_data}{SPACE}{/if}<ColorizedPinyinSyllables
				pinyin={segment.word_data.pinyin_marks}
				tones={segment.word_data.tone_marks}
			/>{:else}{segment.source}{/if}{/each}</span
>
