<script>
	import PreferredCharacters from '@/components/DictionaryContent/PreferredCharacters.svelte';
	import ColorizedPinyinSyllables from '@/components/ColorizedText/ColorizedPinyinSyllables.svelte';
	import { dictionaryDisplaySettingsStore } from '@/stores/dictionaryDisplaySettings.svelte.js';
	import { isMobile } from '@/utils/device.js';

	/**
	 * @typedef {Object} Props
	 * @property {any} [word] - Word Prop
	 * @property {boolean} [separateTraditionalCharacters] - Display traditional characters on a separate line
	 */

	/** @type {Props} */
	const { word = {}, separateTraditionalCharacters = isMobile() } = $props();

	const pinyin = $derived(
		Array.isArray(word.pinyin_marks) ? word.pinyin_marks.join(' ') : (word.pinyin_marks ?? '')
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
			tones={word.tone_marks}
			colorByTone={dictionaryDisplaySettingsStore.settings.colorCharactersByTone}
			stacked={separateTraditionalCharacters}
			lexicalTestIdPrefix="lexical"
		/>
	</h1>
	<div>
		<h3 class="chinese-characters--pinyin-container sy-text--selectable">
			{#if dictionaryDisplaySettingsStore.settings.colorPinyinByTone}
				<ColorizedPinyinSyllables {pinyin} tones={word.tone_marks} />
			{:else}
				{pinyin}
			{/if}
		</h3>
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
	.chinese-characters--character {
		font-size: 3em;
		font-weight: 300;
	}
</style>
