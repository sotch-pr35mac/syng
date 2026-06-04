<!-- Renders pre-tokenized free-form pinyin, coloring each syllable by its tone. -->
<script lang="ts">
	import type { PinyinToken } from '@/types/tools.js';
	import { toneColorClass } from '@/utils/tones.js';

	interface Props {
		tokens?: PinyinToken[];
	}

	const { tokens = [] }: Props = $props();
</script>

<span
	>{#each tokens as token, index (index)}{#if token.tone}<span
				class="sy-text--selectable {toneColorClass(token.tone)}">{token.text}</span
			>{:else}{token.text}{/if}{/each}</span
>
