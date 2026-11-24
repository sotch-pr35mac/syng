<script lang="ts">
	import { dictionaryDisplaySettingsStore } from '@/stores/dictionaryDisplaySettings.svelte.js';
	import {
		HSK_VARIANT_LABELS,
		HSK_VARIANT_VALUES,
		type HskVariant,
	} from '@/types/dictionaryDisplay.js';
	import SyRadio from '@/components/SyRadio/SyRadio.svelte';
	import SyRadioGroup from '@/components/SyRadio/SyRadioGroup.svelte';
	interface Props {
		variant?: 'desktop' | 'mobile';
		label?: string;
		describedBy?: string;
		onchange?: (value: HskVariant) => void;
	}
	const { variant = 'desktop', label = 'HSK', describedBy, onchange }: Props = $props();
</script>

<fieldset
	class="hsk-variant-selector"
	class:hsk-variant-selector--mobile={variant === 'mobile'}
	aria-describedby={describedBy}
>
	<legend>{label}</legend>
	<SyRadioGroup selectedValue={dictionaryDisplaySettingsStore.settings.hskVariant} {variant}>
		{#each HSK_VARIANT_VALUES as value (value)}
			<label
				><SyRadio
					name="hsk-variant"
					{value}
					checked={dictionaryDisplaySettingsStore.settings.hskVariant === value}
					onchange={() => onchange?.(value)}
				/><span>{HSK_VARIANT_LABELS[value]}</span></label
			>
		{/each}
	</SyRadioGroup>
</fieldset>

<style>
	.hsk-variant-selector {
		margin: 0;
		padding: var(--sy-space);
		border: 0;
	}
	.hsk-variant-selector legend {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
	}
	.hsk-variant-selector--mobile {
		padding: 0;
	}
</style>
