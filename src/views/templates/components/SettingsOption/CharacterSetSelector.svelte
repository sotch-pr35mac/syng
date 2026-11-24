<script lang="ts">
	import { dictionaryDisplaySettingsStore } from '@/stores/dictionaryDisplaySettings.svelte.js';
	import { CHARACTER_SETS, type CharacterSet } from '@/types/dictionaryDisplay.js';
	import SyRadio from '@/components/SyRadio/SyRadio.svelte';
	import SyRadioGroup from '@/components/SyRadio/SyRadioGroup.svelte';

	interface Props {
		variant?: 'desktop' | 'mobile';
		label?: string;
		onchange?: (characterSet: CharacterSet) => void;
	}

	const { variant = 'desktop', label = 'Characters', onchange }: Props = $props();
	const options: { value: CharacterSet; label: string }[] = [
		{ value: CHARACTER_SETS.BOTH, label: 'Both' },
		{ value: CHARACTER_SETS.SIMPLIFIED, label: 'Simplified' },
		{ value: CHARACTER_SETS.TRADITIONAL, label: 'Traditional' },
	];
</script>

<fieldset
	class="character-set-selector"
	class:character-set-selector--mobile={variant === 'mobile'}
>
	<legend>{label}</legend>
	<SyRadioGroup selectedValue={dictionaryDisplaySettingsStore.settings.characterSet} {variant}>
		{#each options as option (option.value)}
			<label>
				<SyRadio
					name="character-set"
					value={option.value}
					checked={dictionaryDisplaySettingsStore.settings.characterSet === option.value}
					onchange={() => onchange?.(option.value)}
				/>
				<span>{option.label}</span>
			</label>
		{/each}
	</SyRadioGroup>
</fieldset>

<style>
	.character-set-selector {
		margin: 0;
		padding: var(--sy-space);
		border: 0;
	}

	.character-set-selector legend {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	.character-set-selector--mobile {
		padding: 0;
	}
</style>
