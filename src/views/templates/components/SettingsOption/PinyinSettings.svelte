<script lang="ts">
	import SyToggle from '@/components/SyToggle/SyToggle.svelte';
	import { pinyinSettingsStore } from '@/stores/pinyinSettings.svelte.js';
	import { readerSettingsStore } from '@/stores/readerSettings.svelte.js';
</script>

<div class="pinyin-settings">
	<p>Display pronunciation beneath Chinese characters.</p>
	<div class="option">
		<span>Character animations</span>
		<SyToggle
			accessibleLabel="Show pinyin in character animations"
			checked={pinyinSettingsStore.showCharacterPinyin}
			onchange={pinyinSettingsStore.setCharacterPinyin}
		/>
	</div>
	<div class="option">
		<span>Flashcard fronts</span>
		<SyToggle
			accessibleLabel="Show pinyin on flashcard fronts"
			checked={pinyinSettingsStore.showFlashcardPinyin}
			onchange={pinyinSettingsStore.setFlashcardPinyin}
		/>
	</div>
	<div class="option">
		<span>Reader</span>
		<SyToggle
			accessibleLabel="Show pinyin in Reader"
			checked={readerSettingsStore.settings.showPinyin}
			onchange={readerSettingsStore.setShowPinyin}
		/>
	</div>
</div>

<style>
	.pinyin-settings {
		display: flex;
		flex-direction: column;
		gap: var(--sy-space--large);
	}
	p {
		margin: 0;
		font-size: var(--sy-font-size--small);
		color: var(--sy-text--muted);
	}
	.option {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--sy-space--large);
		min-height: 44px;
	}
</style>
