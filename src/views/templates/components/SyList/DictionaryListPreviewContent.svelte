<script lang="ts">
	import ColorizedPinyinSyllables from '@/components/ColorizedText/ColorizedPinyinSyllables.svelte';
	import PreferredCharacters from '@/components/DictionaryContent/PreferredCharacters.svelte';
	import { dictionaryDisplaySettingsStore } from '@/stores/dictionaryDisplaySettings.svelte.js';
	import type { SearchEntry } from '@/types/search.js';

	interface Props {
		value: { word: SearchEntry };
		mobile?: boolean;
	}

	const { value, mobile = false }: Props = $props();
	const word = $derived(value.word);
	const pinyin = $derived(
		Array.isArray(word.pinyin_marks) ? word.pinyin_marks.join(' ') : word.pinyin_marks
	);
	const colorCharacters = $derived(
		dictionaryDisplaySettingsStore.settings.colorListsByTone &&
			dictionaryDisplaySettingsStore.settings.colorCharactersByTone
	);
	const colorPinyin = $derived(
		dictionaryDisplaySettingsStore.settings.colorListsByTone &&
			dictionaryDisplaySettingsStore.settings.colorPinyinByTone
	);
</script>

{#if mobile}
	<p class="sy-list-preview-item--text sy-list-preview-item--topline">
		<span class="sy-list-preview-item--headline">
			<PreferredCharacters
				simplified={word.simplified}
				traditional={word.traditional}
				tones={word.tone_marks}
				colorByTone={colorCharacters}
				variant="inline"
			/>
		</span>
		{#if pinyin}
			<span class="sy-list-preview-item--subtitle">
				{#if colorPinyin}
					<ColorizedPinyinSyllables {pinyin} tones={word.tone_marks} />
				{:else}
					{pinyin}
				{/if}
			</span>
		{/if}
	</p>
{:else}
	<p class="sy-list-preview-item--text sy-list-preview-item--headline">
		<PreferredCharacters
			simplified={word.simplified}
			traditional={word.traditional}
			tones={word.tone_marks}
			colorByTone={colorCharacters}
			variant="inline"
		/>
	</p>
	<p class="sy-list-preview-item--text sy-list-preview-item--subtitle">
		{#if colorPinyin}
			<ColorizedPinyinSyllables {pinyin} tones={word.tone_marks} />
		{:else}
			{pinyin}
		{/if}
	</p>
{/if}
