<script lang="ts">
	import SyToggle from '@/components/SyToggle/SyToggle.svelte';
	import { readerSettingsStore } from '@/stores/readerSettings.svelte.js';
</script>

<div class="reader-pinyin-toggle">
	<span>Show pinyin</span>
	<SyToggle
		accessibleLabel="Show pinyin"
		checked={readerSettingsStore.settings.showPinyin}
		onchange={readerSettingsStore.setShowPinyin}
	/>
</div>

<style>
	.reader-pinyin-toggle {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--sy-space--large);
		min-height: 44px;
		padding: var(--sy-space--large);
		box-sizing: border-box;
	}
</style>
