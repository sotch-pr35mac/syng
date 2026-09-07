<script lang="ts">
	import PreferredCharacters from '@/components/DictionaryContent/PreferredCharacters.svelte';
	import ColorizedPinyinSyllables from '@/components/ColorizedText/ColorizedPinyinSyllables.svelte';
	import DictionaryListPreviewContent from '@/components/SyList/DictionaryListPreviewContent.svelte';
	import { dictionaryDisplaySettingsStore } from '@/stores/dictionaryDisplaySettings.svelte.js';
	import type { SearchEntry } from '@/types/search.js';

	const PREVIEW_SIMPLIFIED = '汉语';
	const PREVIEW_TRADITIONAL = '漢語';
	const PREVIEW_PINYIN = 'hànyǔ';
	const HAN_TONE = 4;
	const YU_TONE = 3;
	const PREVIEW_TONES = [HAN_TONE, YU_TONE];
	const PREVIEW_LIST_ENTRY: SearchEntry = {
		word_id: 0,
		hash: 'hanyu-preview',
		simplified: PREVIEW_SIMPLIFIED,
		traditional: PREVIEW_TRADITIONAL,
		pinyin_marks: 'hàn yǔ',
		tone_marks: PREVIEW_TONES,
		english: ['Chinese language'],
		measure_words: [],
	};
</script>

<figure class="chinese-preview" aria-live="polite">
	<figcaption class="chinese-preview__label">Preview</figcaption>
	<p class="chinese-preview__characters">
		<PreferredCharacters
			simplified={PREVIEW_SIMPLIFIED}
			traditional={PREVIEW_TRADITIONAL}
			tones={PREVIEW_TONES}
			colorByTone={dictionaryDisplaySettingsStore.settings.colorCharactersByTone}
		/>
	</p>
	<p class="chinese-preview__pinyin" lang="zh-Latn">
		<ColorizedPinyinSyllables
			pinyin={PREVIEW_PINYIN}
			tones={PREVIEW_TONES}
			colorByTone={dictionaryDisplaySettingsStore.settings.colorPinyinByTone}
		/>
	</p>
	<div class="chinese-preview__list">
		<p class="chinese-preview__list-label">List result</p>
		<div class="chinese-preview__list-row">
			<DictionaryListPreviewContent value={{ word: PREVIEW_LIST_ENTRY }} />
			<p class="chinese-preview__list-gloss">Chinese language</p>
		</div>
	</div>
</figure>

<style>
	.chinese-preview {
		margin: 0;
		padding: var(--sy-space--extra-large);
		background-color: var(--sy-color--grey-2);
		border-radius: var(--sy-border-radius);
		display: flex;
		flex-direction: column;
		gap: var(--sy-space--large);
		align-items: stretch;
	}

	.chinese-preview__label,
	.chinese-preview__list-label {
		margin: 0;
		font-size: var(--sy-font-size--small);
		color: var(--sy-text--dark);
	}

	.chinese-preview__characters,
	.chinese-preview__pinyin {
		margin: 0;
		font-size: var(--sy-font-size--large);
		line-height: 1.4;
	}

	.chinese-preview__list {
		display: flex;
		flex-direction: column;
		gap: var(--sy-space);
		margin-top: var(--sy-space);
		padding-top: var(--sy-space--large);
		border-top: var(--sy-border);
	}

	.chinese-preview__list-row {
		display: flex;
		flex-direction: column;
		gap: var(--sy-space);
		padding: var(--sy-space--large);
		background-color: var(--sy-color--white);
		border-radius: var(--sy-border-radius);
	}

	.chinese-preview__list-gloss {
		margin: 0;
		font-size: var(--sy-font-size--small);
		color: var(--sy-text--dark);
	}
</style>
