<script lang="ts">
	import { dictionaryDisplaySettingsStore } from '@/stores/dictionaryDisplaySettings.svelte.js';
	import { CHARACTER_SETS, type CharacterSet } from '@/types/dictionaryDisplay.js';

	interface Props {
		variant?: 'desktop' | 'mobile';
		onchange?: (characterSet: CharacterSet) => void;
	}

	const { variant = 'desktop', onchange }: Props = $props();
	const options: { value: CharacterSet; label: string }[] = [
		{ value: CHARACTER_SETS.BOTH, label: 'Simplified + Traditional' },
		{ value: CHARACTER_SETS.SIMPLIFIED, label: 'Simplified' },
		{ value: CHARACTER_SETS.TRADITIONAL, label: 'Traditional' },
	];
</script>

<fieldset
	class="character-set-selector"
	class:character-set-selector--mobile={variant === 'mobile'}
>
	<legend>Characters</legend>
	{#each options as option (option.value)}
		<label class="character-set-selector__option">
			<input
				type="radio"
				name="character-set"
				value={option.value}
				checked={dictionaryDisplaySettingsStore.settings.characterSet === option.value}
				onchange={() => onchange?.(option.value)}
			/>
			<span>{option.label}</span>
		</label>
	{/each}
</fieldset>

<style>
	.character-set-selector {
		display: flex;
		flex-direction: column;
		gap: var(--sy-space--large);
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

	.character-set-selector__option {
		display: flex;
		align-items: center;
		gap: var(--sy-space--large);
		min-height: 28px;
		font-size: var(--sy-font-size--medium);
		cursor: pointer;
	}

	.character-set-selector__option input {
		accent-color: var(--sy-color--blue-2);
	}

	.character-set-selector--mobile {
		gap: var(--sy-mobile-space--medium);
		padding: 0;
	}

	.character-set-selector--mobile .character-set-selector__option {
		min-height: var(--sy-mobile-touch-target);
		font-size: var(--sy-font-size--mobile-medium);
	}
</style>
