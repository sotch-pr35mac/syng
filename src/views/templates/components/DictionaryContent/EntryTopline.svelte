<script>
	import ChineseCharacters from './ChineseCharacters.svelte';
	import { isMobile } from '../../utils/device.js';

	/**
	 * @typedef {Object} Props
	 * @property {any} [word] - Word Prop
	 */

	/** @type {Props} */
	const { word = {} } = $props();
</script>

<div class="chinese-characters--container">
	<h1
		class="chinese-characters--character-container chinese-characters--character"
		data-testid="chinese-characters"
	>
		<ChineseCharacters characters={word.simplified} tones={word.tone_marks}></ChineseCharacters>
		{#if word.simplified !== word.traditional && !isMobile()}
			&nbsp;(<ChineseCharacters characters={word.traditional} tones={word.tone_marks}
			></ChineseCharacters>)
		{/if}
	</h1>
	{#if word.simplified !== word.traditional && isMobile()}
		<h1
			class="chinese-characters--character-container chinese-characters--character chinese-characters--traditional"
			data-testid="chinese-characters-traditional"
		>
			(<ChineseCharacters characters={word.traditional} tones={word.tone_marks}
			></ChineseCharacters>)
		</h1>
	{/if}
	<div>
		<h3 class="chinese-characters--pinyin-container sy-text--selectable">
			{word.pinyin_marks}
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
		margin: var(--sy-space);
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
	.chinese-characters--traditional {
		margin-top: 0;
	}
</style>
