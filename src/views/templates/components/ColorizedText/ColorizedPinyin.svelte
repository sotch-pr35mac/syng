<script lang="ts">
	import type { PinyinSegment } from '@/types/tools.js';

	interface Props {
		segments?: PinyinSegment[];
	}

	const { segments = [] }: Props = $props();
	const NO_TONE_INDEX = 5;
	const SPACE = ' ';

	function syllables(segment: PinyinSegment): string[] {
		return segment.word_data?.pinyin_marks.split(SPACE) ?? [];
	}

	function toneFor(segment: PinyinSegment, index: number): number {
		return segment.word_data?.tone_marks[index] || NO_TONE_INDEX;
	}
</script>

<span>{#each segments as segment, segmentIndex (segmentIndex)}{#if segment.word_data}{#if segmentIndex > 0 && segments[segmentIndex - 1].word_data}{SPACE}{/if}{#each syllables(segment) as syllable, syllableIndex (syllableIndex)}<span class="sy-text--selectable {`colored-pinyin--tone-${toneFor(segment, syllableIndex)}`}">{syllable}</span>{#if syllableIndex < syllables(segment).length - 1}{SPACE}{/if}{/each}{:else}{segment.source}{/if}{/each}</span>

<style>
	.colored-pinyin--tone-1 {
		color: var(--sy-tone-color--1);
	}
	.colored-pinyin--tone-2 {
		color: var(--sy-tone-color--2);
	}
	.colored-pinyin--tone-3 {
		color: var(--sy-tone-color--3);
	}
	.colored-pinyin--tone-4 {
		color: var(--sy-tone-color--4);
	}
	.colored-pinyin--tone-5 {
		color: var(--sy-tone-color--5);
	}
</style>
