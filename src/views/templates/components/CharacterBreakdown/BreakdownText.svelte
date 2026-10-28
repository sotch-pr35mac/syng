<script lang="ts">
	import DictionaryLink from '@/components/DictionaryContent/DictionaryLink.svelte';
	import type { DictionaryLookupRequest } from '@/composables/dictionaryPopover.svelte.js';
	const {
		text,
		onlink,
	}: {
		text: string;
		onlink: (request: DictionaryLookupRequest) => void;
	} = $props();
	// Keep source prose verbatim, including pronunciation annotations and script forms.
	const segments = $derived(text.split(/(\p{Script=Han}+)/u));
</script>

{#each segments as segment, index (index)}
	{#if index % 2 === 1}
		<DictionaryLink link={segment} onopen={({ detail }) => onlink(detail)}
			>{segment}</DictionaryLink
		>
	{:else}{segment}{/if}
{/each}
