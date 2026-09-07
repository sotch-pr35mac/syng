<script lang="ts">
	import { dictionaryDisplaySettingsStore } from '@/stores/dictionaryDisplaySettings.svelte.js';
	import {
		HSK_VARIANT_LABELS,
		HSK_VARIANT_VALUES,
		type HskVariant,
	} from '@/types/dictionaryDisplay.js';
	interface Props {
		variant?: 'desktop' | 'mobile';
		onchange?: (value: HskVariant) => void;
	}
	const { variant = 'desktop', onchange }: Props = $props();
</script>

<fieldset class="hsk-variant-selector" class:hsk-variant-selector--mobile={variant === 'mobile'}>
	<legend>HSK</legend>
	{#each HSK_VARIANT_VALUES as value (value)}
		<label class="hsk-variant-selector__option"
			><input
				type="radio"
				name="hsk-variant"
				{value}
				checked={dictionaryDisplaySettingsStore.settings.hskVariant === value}
				onchange={() => onchange?.(value)}
			/><span>{HSK_VARIANT_LABELS[value]}</span></label
		>
	{/each}
</fieldset>

<style>
	.hsk-variant-selector {
		display: flex;
		flex-direction: column;
		gap: var(--sy-space--large);
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
	.hsk-variant-selector__option {
		display: flex;
		align-items: center;
		gap: var(--sy-space--large);
		min-height: 28px;
		font-size: var(--sy-font-size--medium);
		cursor: pointer;
	}
	.hsk-variant-selector__option input {
		accent-color: var(--sy-color--blue-2);
	}
	.hsk-variant-selector--mobile {
		gap: var(--sy-mobile-space--medium);
		padding: 0;
	}
	.hsk-variant-selector--mobile .hsk-variant-selector__option {
		min-height: var(--sy-mobile-touch-target);
		font-size: var(--sy-font-size--mobile-medium);
	}
</style>
