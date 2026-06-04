<!--
	Renders the Extras output area shared by the desktop and mobile routes: tone-colored
	characters or pinyin for the colorize tool, and plain converted text for the others.
-->
<script lang="ts">
	import ChineseCharacters from '@/components/DictionaryContent/ChineseCharacters.svelte';
	import ColorizedPinyin from '@/components/ColorizedText/ColorizedPinyin.svelte';
	import ColorizedRawPinyinText from '@/components/ColorizedText/ColorizedRawPinyinText.svelte';
	import { colorizeModeForOutput } from '@/composables/textConversionTools.js';
	import { toolsStore } from '@/composables/tools.svelte.js';
	import type { ToolName } from '@/types/tools.js';

	interface Props {
		tool: ToolName;
		outputText: string;
	}

	const { tool, outputText }: Props = $props();
</script>

{#if tool === 'colorize'}
	{#if colorizeModeForOutput() === 'pinyin'}
		{#if toolsStore.colorizeTokens.length > 0}
			<ColorizedRawPinyinText tokens={toolsStore.colorizeTokens} />
		{:else}
			<ColorizedPinyin segments={toolsStore.colorizeResult} />
		{/if}
	{:else}
		{#each toolsStore.colorizeResult as segment, index (index)}
			{#if segment.word_data}
				<ChineseCharacters
					characters={toolsStore.colorizeResolvedScript === 'automatic'
						? segment.source
						: toolsStore.colorizeResolvedScript === 'simplified'
							? segment.word_data.simplified
							: segment.word_data.traditional}
					tones={segment.word_data.tone_marks}
				/>
			{:else}
				{segment.source}
			{/if}
		{/each}
	{/if}
{:else}
	{outputText}
{/if}
