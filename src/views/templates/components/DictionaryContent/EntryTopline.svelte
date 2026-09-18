<script>
	import CharacterSetLabel from '@/components/DictionaryContent/CharacterSetLabel.svelte';
	import PreferredCharacters from '@/components/DictionaryContent/PreferredCharacters.svelte';
	import ColorizedPinyinSyllables from '@/components/ColorizedText/ColorizedPinyinSyllables.svelte';
	import { dictionaryDisplaySettingsStore } from '@/stores/dictionaryDisplaySettings.svelte.js';
	import { isMobile } from '@/utils/device.js';
	import { lexicalAlternativePronunciations, lexicalPinyin } from '@/types/dictionary.js';

	/**
	 * @typedef {Object} Props
	 * @property {any} [word] - Word Prop
	 * @property {boolean} [separateTraditionalCharacters] - Display traditional characters on a separate line
	 */

	/** @type {Props} */
	const { word = {}, separateTraditionalCharacters = isMobile() } = $props();

	const pinyinData = $derived(lexicalPinyin(word));
	const pinyin = $derived(pinyinData.marks);
	const alternativePronunciations = $derived(
		dictionaryDisplaySettingsStore.settings.showAlternativePronunciations
			? lexicalAlternativePronunciations(word)
			: []
	);
</script>

<div class="chinese-characters--container">
	<h1
		class="chinese-characters--character-container chinese-characters--character"
		class:chinese-characters--character-container--stacked={separateTraditionalCharacters}
		data-testid="chinese-characters"
	>
		<PreferredCharacters
			simplified={word.simplified}
			traditional={word.traditional}
			tones={pinyinData.tones}
			colorByTone={dictionaryDisplaySettingsStore.settings.colorCharactersByTone}
			stacked={separateTraditionalCharacters}
			lexicalTestIdPrefix="lexical"
		/>
	</h1>
	<div>
		<h3 class="chinese-characters--pinyin-container sy-text--selectable">
			{#if dictionaryDisplaySettingsStore.settings.colorPinyinByTone}
				<ColorizedPinyinSyllables {pinyin} tones={pinyinData.tones} />
			{:else}
				{pinyin}
			{/if}
		</h3>
		{#if alternativePronunciations.length}
			<div class="chinese-characters--alternative-pronunciations">
				{#each alternativePronunciations as alternative, alternativeIndex (`${alternative.value.label}-${alternativeIndex}`)}
					<div class="chinese-characters--alternative-pronunciation">
						<CharacterSetLabel
							label="alt"
							variant="inline"
							testId="alternative-pronunciation-label"
						/>
						<span class="chinese-characters--alternative-pronunciation-text">
							{#if dictionaryDisplaySettingsStore.settings.colorPinyinByTone}
								<ColorizedPinyinSyllables
									pinyin={alternative.value.pronunciation.marks}
									tones={alternative.value.pronunciation.tones}
								/>
							{:else}
								{alternative.value.pronunciation.marks}
							{/if}
						</span>
						<span class="chinese-characters--alternative-pronunciation-name">
							({alternative.value.label})
						</span>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>

<style>
	.chinese-characters--container {
		display: flex;
		flex-direction: column;
	}
	.chinese-characters--character-container {
		display: flex;
		flex-direction: row;
		align-items: baseline;
		flex-wrap: wrap;
		gap: var(--sy-space--extra-large);
		margin: var(--sy-space);
	}
	.chinese-characters--character-container--stacked {
		align-items: flex-start;
		flex-direction: column;
		gap: 0;
	}
	.chinese-characters--pinyin-container {
		font-size: 1.6em;
		font-weight: 300;
		margin: var(--sy-space--small) var(--sy-space--large);
		color: var(--sy-color--grey-4);
	}
	.chinese-characters--alternative-pronunciations {
		margin: var(--sy-space--small) var(--sy-space--large);
		color: var(--sy-color--grey-4);
	}
	.chinese-characters--alternative-pronunciation {
		display: flex;
		align-items: baseline;
		font-size: 1.6em;
		font-weight: 300;
		line-height: 1.35;
	}
	.chinese-characters--alternative-pronunciation :global(.character-set-label--inline) {
		/* Match the 0.3em label in the 3em lexical-character heading. */
		font-size: 0.5625em;
	}
	.chinese-characters--alternative-pronunciation-text {
		font-size: 1em;
	}
	.chinese-characters--alternative-pronunciation-name {
		margin-left: var(--sy-space--large);
		font-size: 0.5625em;
	}
	.chinese-characters--character {
		font-size: 3em;
		font-weight: 300;
	}
</style>
