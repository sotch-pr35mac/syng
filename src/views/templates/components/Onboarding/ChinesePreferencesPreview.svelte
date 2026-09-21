<script lang="ts">
	import PreferredCharacters from '@/components/DictionaryContent/PreferredCharacters.svelte';
	import CharacterSetLabel from '@/components/DictionaryContent/CharacterSetLabel.svelte';
	import ColorizedPinyinSyllables from '@/components/ColorizedText/ColorizedPinyinSyllables.svelte';
	import DictionaryListPreviewContent from '@/components/SyList/DictionaryListPreviewContent.svelte';
	import SyTag from '@/components/SyTag/SyTag.svelte';
	import { dictionaryDisplaySettingsStore } from '@/stores/dictionaryDisplaySettings.svelte.js';
	import {
		formatPartOfSpeech,
		formatQualifierCategory,
		lexicalPartsOfSpeech,
	} from '@/types/dictionary.js';
	import { HSK_VARIANT_LABELS } from '@/types/dictionaryDisplay.js';
	import { HSK_LEVELS } from '@/types/hsk.js';
	import type { AlternativePronunciation, Definition } from '@/types/dictionary.js';
	import type { SearchEntry } from '@/types/search.js';
	import { resolveHskLevels } from '@/utils/hsk.js';

	const PREVIEW_SIMPLIFIED = '汉语';
	const PREVIEW_TRADITIONAL = '漢語';
	const PREVIEW_PINYIN = 'hàn yǔ';
	const HAN_TONE = 4;
	const YU_TONE = 3;
	const PREVIEW_TONES = [HAN_TONE, YU_TONE];
	const PREVIEW_ALTERNATIVE_PRONUNCIATION: AlternativePronunciation = {
		pronunciation: { marks: 'hàn yú', numbers: 'han4yu2', tones: [HAN_TONE, 2] },
		label: 'also pr.',
	};
	const PREVIEW_DEFINITION: Definition = {
		gloss: { value: 'Chinese language', sources: ['cc-cedict'] },
		examples: [],
		commentary: [],
		qualifiers: [
			{ value: { category: 'domain', value: 'linguistics' }, sources: ['cc-cedict'] },
		],
		lexical_kinds: [],
		parts_of_speech: [{ value: 'noun', sources: ['cc-cedict'] }],
		alternative_pronunciations: [],
		measure_words: [],
	};
	const PREVIEW_LIST_ENTRY: SearchEntry = {
		id: '1:0000000000000000000000000000000000000000000000000000000000000000',
		simplified: PREVIEW_SIMPLIFIED,
		traditional: PREVIEW_TRADITIONAL,
		pinyin: { marks: PREVIEW_PINYIN, numbers: 'han4yu3', tones: PREVIEW_TONES },
		commonness: 0,
		alternative_pronunciations: [
			{ value: PREVIEW_ALTERNATIVE_PRONUNCIATION, sources: ['cc-cedict'] },
		],
		measure_words: [],
		english: [PREVIEW_DEFINITION],
		hsk: {
			hsk_2015: [HSK_LEVELS.ONE],
			proficiency_standard_2021: [HSK_LEVELS.ONE],
			hsk_exam_syllabus_2025: [HSK_LEVELS.ONE],
		},
	};
	const previewHskLevels = $derived(
		resolveHskLevels(PREVIEW_LIST_ENTRY.hsk, dictionaryDisplaySettingsStore.settings.hskVariant)
	);
	const previewPartsOfSpeech = $derived(
		dictionaryDisplaySettingsStore.settings.showPartsOfSpeech
			? lexicalPartsOfSpeech(PREVIEW_LIST_ENTRY)
			: []
	);
	const previewQualifiers = $derived(
		dictionaryDisplaySettingsStore.settings.showQualifiers ? PREVIEW_DEFINITION.qualifiers : []
	);
</script>

<figure class="chinese-preview" aria-live="polite">
	<figcaption class="chinese-preview__label">Preview</figcaption>
	<div class="chinese-preview__word">
		<p class="chinese-preview__characters">
			<PreferredCharacters
				simplified={PREVIEW_SIMPLIFIED}
				traditional={PREVIEW_TRADITIONAL}
				tones={PREVIEW_TONES}
				colorByTone={dictionaryDisplaySettingsStore.settings.colorCharactersByTone}
			/>
		</p>
		<div class="chinese-preview__word-tags">
			{#if previewHskLevels.length}
				<SyTag
					variant="yellow"
					tooltip={HSK_VARIANT_LABELS[dictionaryDisplaySettingsStore.settings.hskVariant]}
				>
					HSK: {previewHskLevels.join(', ')}
				</SyTag>
			{/if}
			{#each previewPartsOfSpeech as partOfSpeech (partOfSpeech.value)}
				<SyTag variant="blue">
					{formatPartOfSpeech(partOfSpeech.value)}
				</SyTag>
			{/each}
			{#each previewQualifiers as qualifier (qualifier.value.value)}
				<SyTag variant="green" tooltip={formatQualifierCategory(qualifier.value.category)}>
					{qualifier.value.value}
				</SyTag>
			{/each}
		</div>
	</div>
	<p class="chinese-preview__pinyin" lang="zh-Latn">
		<ColorizedPinyinSyllables
			pinyin={PREVIEW_PINYIN}
			tones={PREVIEW_TONES}
			colorByTone={dictionaryDisplaySettingsStore.settings.colorPinyinByTone}
		/>
	</p>
	{#if dictionaryDisplaySettingsStore.settings.showAlternativePronunciations}
		<p class="chinese-preview__alternative-pronunciation" lang="zh-Latn">
			<CharacterSetLabel
				label="alt"
				description="Alternative pronunciation"
				variant="inline"
			/>
			<ColorizedPinyinSyllables
				pinyin={PREVIEW_ALTERNATIVE_PRONUNCIATION.pronunciation.marks}
				tones={PREVIEW_ALTERNATIVE_PRONUNCIATION.pronunciation.tones}
				colorByTone={dictionaryDisplaySettingsStore.settings.colorPinyinByTone}
			/>
			<span>({PREVIEW_ALTERNATIVE_PRONUNCIATION.label})</span>
		</p>
	{/if}
	<div class="chinese-preview__list">
		<p class="chinese-preview__list-label">List result</p>
		<div class="chinese-preview__list-row">
			<div class="chinese-preview__list-entry">
				<div>
					<DictionaryListPreviewContent value={{ word: PREVIEW_LIST_ENTRY }} />
				</div>
			</div>
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
	.chinese-preview__pinyin,
	.chinese-preview__alternative-pronunciation {
		margin: 0;
		font-size: var(--sy-font-size--large);
		line-height: 1.4;
	}

	.chinese-preview__alternative-pronunciation {
		display: flex;
		align-items: baseline;
		gap: var(--sy-space--small);
		color: var(--sy-text--dark);
	}

	.chinese-preview__alternative-pronunciation span:last-child {
		font-size: var(--sy-font-size--small);
	}

	.chinese-preview__word {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--sy-space--large);
	}

	.chinese-preview__word-tags {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: var(--sy-space);
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

	.chinese-preview__list-entry {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--sy-space--large);
	}

	.chinese-preview__list-gloss {
		margin: 0;
		font-size: var(--sy-font-size--small);
		color: var(--sy-text--dark);
	}
</style>
