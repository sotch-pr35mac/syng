<script lang="ts">
	import { NO_TONE_INDEX } from '@/utils/tones.js';
	import type { Pinyin } from '@/types/dictionary.js';
	import ColorizedPinyinSyllables from '@/components/ColorizedText/ColorizedPinyinSyllables.svelte';
	const {
		characters = '',
		pinyin,
		showPinyin = false,
		colorByTone = false,
	}: {
		characters?: string;
		pinyin?: Pinyin;
		showPinyin?: boolean;
		colorByTone?: boolean;
	} = $props();
	const glyphs = $derived(Array.from(characters));
	const syllables = $derived(pinyin?.marks.trim().split(/\s+/).filter(Boolean) ?? []);
	const aligned = $derived(glyphs.length === syllables.length);
</script>

<div class="animation-word">
	<div id="character-target" data-testid="character-target">
		{#each glyphs as character, index (`${index}-${character}`)}
			<div class="character-cell">
				<div data-character-writer aria-label={character} lang="zh"></div>
				{#if showPinyin && aligned && syllables[index]}
					<span class="pronunciation" lang="zh-Latn">
						<ColorizedPinyinSyllables
							pinyin={syllables[index]}
							tones={[pinyin?.tones[index] ?? NO_TONE_INDEX]}
							{colorByTone}
						/>
					</span>
				{/if}
			</div>
		{/each}
	</div>
	{#if showPinyin && !aligned && pinyin?.marks}
		<span class="pronunciation" lang="zh-Latn"
			><ColorizedPinyinSyllables
				pinyin={pinyin.marks}
				tones={pinyin.tones}
				{colorByTone}
			/></span
		>
	{/if}
</div>

<style>
	.animation-word {
		width: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--sy-space--large);
	}
	#character-target {
		display: flex;
		flex-wrap: wrap;
		align-items: start;
		justify-content: center;
		width: 100%;
	}
	.character-cell {
		display: flex;
		flex-direction: column;
		align-items: center;
		width: 200px;
		max-width: 100%;
	}
	[data-character-writer] {
		width: 100%;
		aspect-ratio: 1;
	}
	[data-character-writer] :global(svg) {
		display: block;
		width: 100%;
		height: auto;
	}
	.pronunciation {
		font-size: var(--sy-font-size--heading);
		line-height: 1.5;
		text-align: center;
		overflow-wrap: anywhere;
	}
</style>
