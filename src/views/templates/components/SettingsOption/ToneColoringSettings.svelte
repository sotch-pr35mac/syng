<script lang="ts">
	import SyToggle from '@/components/SyToggle/SyToggle.svelte';
	import { dictionaryDisplaySettingsStore } from '@/stores/dictionaryDisplaySettings.svelte.js';

	interface Props {
		variant?: 'desktop' | 'mobile';
		oncharacterschange?: (checked: boolean) => void;
		onpinyinchange?: (checked: boolean) => void;
		onlistschange?: (checked: boolean) => void;
	}

	const {
		variant = 'desktop',
		oncharacterschange,
		onpinyinchange,
		onlistschange,
	}: Props = $props();
</script>

<div class="tone-coloring-settings" class:tone-coloring-settings--mobile={variant === 'mobile'}>
	<div class="tone-coloring-settings__option">
		<span>Color characters by tone</span>
		<SyToggle
			id="color-characters-by-tone"
			value="color-characters-by-tone"
			accessibleLabel="Color characters by tone"
			checked={dictionaryDisplaySettingsStore.settings.colorCharactersByTone}
			onchange={oncharacterschange}
		/>
	</div>
	<div class="tone-coloring-settings__option">
		<span>Color pinyin by tone</span>
		<SyToggle
			id="color-pinyin-by-tone"
			value="color-pinyin-by-tone"
			accessibleLabel="Color pinyin by tone"
			checked={dictionaryDisplaySettingsStore.settings.colorPinyinByTone}
			onchange={onpinyinchange}
		/>
	</div>
	<div class="tone-coloring-settings__option">
		<span>Apply tone coloring to lists</span>
		<SyToggle
			id="color-lists-by-tone"
			value="color-lists-by-tone"
			accessibleLabel="Apply tone coloring to lists"
			checked={dictionaryDisplaySettingsStore.settings.colorListsByTone}
			onchange={onlistschange}
		/>
	</div>
</div>

<style>
	.tone-coloring-settings {
		display: flex;
		flex-direction: column;
		gap: var(--sy-space--large);
		padding: var(--sy-space);
	}

	.tone-coloring-settings__option {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--sy-space--large);
		min-height: 32px;
		font-size: var(--sy-font-size--medium);
	}

	.tone-coloring-settings--mobile {
		gap: var(--sy-mobile-space--medium);
		padding: 0;
	}

	.tone-coloring-settings--mobile .tone-coloring-settings__option {
		min-height: var(--sy-mobile-touch-target);
		font-size: var(--sy-font-size--mobile-medium);
	}
</style>
