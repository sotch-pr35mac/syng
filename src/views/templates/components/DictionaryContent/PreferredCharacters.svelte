<script lang="ts">
	import CharacterSetLabel from '@/components/DictionaryContent/CharacterSetLabel.svelte';
	import ChineseCharacters from '@/components/DictionaryContent/ChineseCharacters.svelte';
	import { dictionaryDisplaySettingsStore } from '@/stores/dictionaryDisplaySettings.svelte.js';
	import { CHARACTER_SETS, type CharacterScript } from '@/types/dictionaryDisplay.js';
	import { resolveCharacterForms } from '@/utils/dictionaryDisplay.js';

	interface Props {
		simplified?: string;
		traditional?: string;
		tones?: number[];
		colorByTone?: boolean;
		variant?: 'display' | 'inline';
		stacked?: boolean;
		lexicalTestIdPrefix?: string;
	}

	const {
		simplified = '',
		traditional = '',
		tones = [],
		colorByTone = false,
		variant = 'display',
		stacked = false,
		lexicalTestIdPrefix,
	}: Props = $props();

	const characterForms = $derived(
		resolveCharacterForms(
			simplified,
			traditional,
			dictionaryDisplaySettingsStore.settings.characterSet
		)
	);
	const useParentheticalInlineForm = $derived(
		variant === 'inline' && characterForms.length === 2
	);

	function scriptDescription(script: CharacterScript): string {
		return script === CHARACTER_SETS.SIMPLIFIED ? 'Simplified Chinese' : 'Traditional Chinese';
	}

	function scriptLanguage(script: CharacterScript): string {
		return script === CHARACTER_SETS.SIMPLIFIED ? 'zh-Hans' : 'zh-Hant';
	}
</script>

<span
	class="preferred-characters"
	class:preferred-characters--inline={variant === 'inline'}
	class:preferred-characters--stacked={stacked}
>
	{#if useParentheticalInlineForm}
		<span class="preferred-characters__inline-lexical sy-text--selectable">
			{#each characterForms as form, index (form.script)}
				{#if index > 0}（{/if}<span
					class="preferred-characters__lexical"
					data-testid={lexicalTestIdPrefix
						? `${lexicalTestIdPrefix}-${form.script}`
						: undefined}
					lang={scriptLanguage(form.script)}
					aria-label={`${scriptDescription(form.script)}: ${form.characters}`}
				>
					{#if colorByTone}
						<ChineseCharacters characters={form.characters} {tones} {colorByTone} />
					{:else}
						{form.characters}
					{/if}
				</span>{#if index > 0}）{/if}
			{/each}
		</span>
	{:else}
		{#each characterForms as form (form.script)}
			<span class="preferred-characters__form">
				{#if form.showLabel}
					<CharacterSetLabel script={form.script} {variant} />
				{/if}
				<span
					class="preferred-characters__lexical sy-text--selectable"
					data-testid={lexicalTestIdPrefix
						? `${lexicalTestIdPrefix}-${form.script}`
						: undefined}
				>
					{#if colorByTone}
						<ChineseCharacters characters={form.characters} {tones} {colorByTone} />
					{:else}
						{form.characters}
					{/if}
				</span>
			</span>
		{/each}
	{/if}
</span>

<style>
	.preferred-characters {
		display: inline-flex;
		align-items: baseline;
		flex-wrap: wrap;
		gap: var(--sy-space--extra-large);
	}
	.preferred-characters--inline {
		gap: var(--sy-space--large);
	}
	.preferred-characters--stacked {
		align-items: flex-start;
		flex-direction: column;
		gap: 0;
	}
	.preferred-characters__form {
		display: inline-flex;
		align-items: baseline;
	}
</style>
