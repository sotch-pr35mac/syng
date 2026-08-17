<script lang="ts">
	import PreferredCharacters from '@/components/DictionaryContent/PreferredCharacters.svelte';
	import type { QuizCharacterOption } from '@/composables/study.js';

	interface Props {
		text: string;
		characters?: QuizCharacterOption;
		variant?: 'display' | 'inline';
		stacked?: boolean;
		lexicalTestIdPrefix?: string;
	}

	const {
		text,
		characters,
		variant = 'inline',
		stacked = false,
		lexicalTestIdPrefix,
	}: Props = $props();
</script>

{#if characters}
	<PreferredCharacters
		simplified={characters.simplified}
		traditional={characters.traditional}
		{variant}
		{stacked}
		{lexicalTestIdPrefix}
	/>
{:else}
	{text}
{/if}
