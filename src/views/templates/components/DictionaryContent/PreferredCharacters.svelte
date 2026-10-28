<script lang="ts">
	import ColorizedPinyinSyllables from '@/components/ColorizedText/ColorizedPinyinSyllables.svelte';
	import type { Pinyin } from '@/types/dictionary.js';
	import CharacterSetLabel from '@/components/DictionaryContent/CharacterSetLabel.svelte';
	import ChineseCharacters from '@/components/DictionaryContent/ChineseCharacters.svelte';
	import { dictionaryDisplaySettingsStore } from '@/stores/dictionaryDisplaySettings.svelte.js';
	import { CHARACTER_SETS, type CharacterScript } from '@/types/dictionaryDisplay.js';
	import { resolveCharacterForms } from '@/utils/dictionaryDisplay.js';

	interface Props {
		simplified?: string;
		traditional?: string;
		tones?: number[];
		pinyin?: Pinyin;
		colorPinyinByTone?: boolean;
		colorByTone?: boolean;
		variant?: 'display' | 'inline';
		stacked?: boolean;
		lexicalTestIdPrefix?: string;
	}

	const {
		simplified = '',
		traditional = '',
		tones = [],
		pinyin,
		colorPinyinByTone = false,
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
	{:else if pinyin?.marks}
		{#each characterForms as form (form.script)}
			<span class="preferred-characters__form">
				{#if form.showLabel}<CharacterSetLabel script={form.script} {variant} />{/if}
				<span class="preferred-characters__word">
					<span
						class="preferred-characters__lexical sy-text--selectable"
						lang={scriptLanguage(form.script)}
						data-testid={lexicalTestIdPrefix
							? `${lexicalTestIdPrefix}-${form.script}`
							: undefined}
					>
						{#if colorByTone}<ChineseCharacters
								characters={form.characters}
								{tones}
								{colorByTone}
							/>{:else}{form.characters}{/if}
					</span>
					<span class="preferred-characters__pinyin" lang="zh-Latn"
						><ColorizedPinyinSyllables
							pinyin={pinyin.marks}
							tones={pinyin.tones}
							colorByTone={colorPinyinByTone}
						/></span
					>
				</span>
			</span>
		{/each}
	{:else}
		{#each characterForms as form (form.script)}
			<span class="preferred-characters__form">
				{#if form.showLabel}
					<CharacterSetLabel script={form.script} {variant} />
				{/if}
				<span
					class="preferred-characters__lexical sy-text--selectable"
					lang={scriptLanguage(form.script)}
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
	.preferred-characters__word {
		display: inline-flex;
		flex-direction: column;
		align-items: center;
	}
	.preferred-characters__pinyin {
		font-size: 0.35em;
		font-weight: var(--sy-font-weight--light);
		line-height: 1.5;
		white-space: normal;
	}

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
