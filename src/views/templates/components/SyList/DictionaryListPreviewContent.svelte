<script lang="ts">
	import ColorizedPinyinSyllables from '@/components/ColorizedText/ColorizedPinyinSyllables.svelte';
	import PreferredCharacters from '@/components/DictionaryContent/PreferredCharacters.svelte';
	import { dictionaryDisplaySettingsStore } from '@/stores/dictionaryDisplaySettings.svelte.js';
	import type { SearchEntry } from '@/types/search.js';
	import { lexicalPinyin } from '@/types/dictionary.js';

	interface Props {
		value: { word: SearchEntry };
		mobile?: boolean;
	}

	const { value, mobile = false }: Props = $props();
	const word = $derived(value.word);
	const pinyinData = $derived(lexicalPinyin(word));
	const pinyin = $derived(pinyinData.marks);
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
	<span class="sy-list-preview-item--text sy-list-preview-item--topline">
		<span class="sy-list-preview-item--headline">
			<PreferredCharacters
				simplified={word.simplified}
				traditional={word.traditional}
				tones={pinyinData.tones}
				colorByTone={colorCharacters}
				variant="inline"
			/>
		</span>
		{#if pinyin}
			<span class="sy-list-preview-item--subtitle">
				{#if colorPinyin}
					<ColorizedPinyinSyllables {pinyin} tones={pinyinData.tones} />
				{:else}
					{pinyin}
				{/if}
			</span>
		{/if}
	</span>
{:else}
	<span class="sy-list-preview-item--text sy-list-preview-item--headline">
		<PreferredCharacters
			simplified={word.simplified}
			traditional={word.traditional}
			tones={pinyinData.tones}
			colorByTone={colorCharacters}
			variant="inline"
		/>
	</span>
	<span class="sy-list-preview-item--text sy-list-preview-item--subtitle">
		{#if colorPinyin}
			<ColorizedPinyinSyllables {pinyin} tones={pinyinData.tones} />
		{:else}
			{pinyin}
		{/if}
	</span>
{/if}
