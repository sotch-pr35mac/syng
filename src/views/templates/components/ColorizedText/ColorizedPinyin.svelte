<!-- Colors dictionary-backed schema-4 Pinyin segments. -->
<script lang="ts">
	import type { PinyinSegment } from '@/types/tools.js';
	import ColorizedPinyinSyllables from '@/components/ColorizedText/ColorizedPinyinSyllables.svelte';
	import { lexicalPinyin, lexicalUnitFromToolSegment } from '@/types/dictionary.js';

	interface Props {
		segments?: PinyinSegment[];
	}

	const { segments = [] }: Props = $props();
	const SPACE = ' ';
	const lexicalUnit = (segment: PinyinSegment) => lexicalUnitFromToolSegment(segment);
</script>

<span
	>{#each segments as segment, segmentIndex (segmentIndex)}{#if lexicalUnit(segment)}{#if segmentIndex > 0 && lexicalUnit(segments[segmentIndex - 1])}{SPACE}{/if}<ColorizedPinyinSyllables
				pinyin={lexicalPinyin(lexicalUnit(segment)).marks}
				tones={lexicalPinyin(lexicalUnit(segment)).tones}
			/>{:else}{segment.source}{/if}{/each}</span
>
