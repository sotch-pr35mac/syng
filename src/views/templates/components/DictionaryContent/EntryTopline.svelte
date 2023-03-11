<script>
import ChineseCharacters from './ChineseCharacters.svelte';

/* Word Prop */
export let word = {};
</script>

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
</style>

<div class="chinese-characters--container">
	<h1 class="chinese-characters--character-container chinese-characters--character" data-testid="chinese-characters">
		<ChineseCharacters characters="{word.simplified}" tones="{word.tone_marks}"></ChineseCharacters>
		{#if word.simplified != word.traditional}
			&nbsp;(<ChineseCharacters characters="{word.traditional}" tones="{word.tone_marks}"></ChineseCharacters>)
		{/if}
	</h1>
	<div>
		<h3 class="chinese-characters--pinyin-container">
			{word.pinyin_marks}
		</h3>
	</div>
</div>