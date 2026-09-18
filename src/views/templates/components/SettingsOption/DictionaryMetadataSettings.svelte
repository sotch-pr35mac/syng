<script lang="ts">
	import SyToggle from '@/components/SyToggle/SyToggle.svelte';
	import { dictionaryDisplaySettingsStore } from '@/stores/dictionaryDisplaySettings.svelte.js';

	interface Props {
		variant?: 'desktop' | 'mobile';
		onqualifierschange?: (checked: boolean) => void;
		onpartsofspeechchange?: (checked: boolean) => void;
		onalternativepronunciationschange?: (checked: boolean) => void;
	}

	const {
		variant = 'desktop',
		onqualifierschange,
		onpartsofspeechchange,
		onalternativepronunciationschange,
	}: Props = $props();
</script>

<div
	class="dictionary-metadata-settings"
	class:dictionary-metadata-settings--mobile={variant === 'mobile'}
>
	<div class="dictionary-metadata-settings__option">
		<span>Show qualifiers</span>
		<SyToggle
			id="show-qualifiers"
			value="show-qualifiers"
			accessibleLabel="Show qualifiers"
			checked={dictionaryDisplaySettingsStore.settings.showQualifiers}
			onchange={onqualifierschange}
		/>
	</div>
	<div class="dictionary-metadata-settings__option">
		<span>Show parts of speech</span>
		<SyToggle
			id="show-parts-of-speech"
			value="show-parts-of-speech"
			accessibleLabel="Show parts of speech"
			checked={dictionaryDisplaySettingsStore.settings.showPartsOfSpeech}
			onchange={onpartsofspeechchange}
		/>
	</div>
	<div class="dictionary-metadata-settings__option">
		<span>Show alternative pronunciations</span>
		<SyToggle
			id="show-alternative-pronunciations"
			value="show-alternative-pronunciations"
			accessibleLabel="Show alternative pronunciations"
			checked={dictionaryDisplaySettingsStore.settings.showAlternativePronunciations}
			onchange={onalternativepronunciationschange}
		/>
	</div>
</div>

<style>
	.dictionary-metadata-settings {
		display: flex;
		flex-direction: column;
		gap: var(--sy-space--large);
		padding: var(--sy-space);
	}

	.dictionary-metadata-settings__option {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--sy-space--large);
		min-height: 32px;
		font-size: var(--sy-font-size--medium);
	}

	.dictionary-metadata-settings--mobile {
		gap: var(--sy-mobile-space--medium);
		padding: 0;
	}

	.dictionary-metadata-settings--mobile .dictionary-metadata-settings__option {
		min-height: var(--sy-mobile-touch-target);
		font-size: var(--sy-font-size--mobile-medium);
	}
</style>
