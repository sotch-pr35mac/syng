<!-- Colors dictionary-backed pinyin segments using native word_data tone metadata. -->
<script lang="ts">
	import type { PinyinSegment } from '@/types/tools.js';
	import { NO_TONE_INDEX, toneColorClass } from '@/utils/tones.js';

	interface Props {
		segments?: PinyinSegment[];
	}

	const { segments = [] }: Props = $props();
	const SPACE = ' ';

	function syllables(segment: PinyinSegment): string[] {
		return segment.word_data?.pinyin_marks.split(SPACE) ?? [];
	}

	function toneFor(segment: PinyinSegment, index: number): number {
		return segment.word_data?.tone_marks[index] || NO_TONE_INDEX;
	}
</script>

<span
	>{#each segments as segment, segmentIndex (segmentIndex)}{#if segment.word_data}{#if segmentIndex > 0 && segments[segmentIndex - 1].word_data}{SPACE}{/if}{#each syllables(segment) as syllable, syllableIndex (syllableIndex)}<span
					class="sy-text--selectable {toneColorClass(toneFor(segment, syllableIndex))}"
					>{syllable}</span
				>{#if syllableIndex < syllables(segment).length - 1}{SPACE}{/if}{/each}{:else}{segment.source}{/if}{/each}</span
>
