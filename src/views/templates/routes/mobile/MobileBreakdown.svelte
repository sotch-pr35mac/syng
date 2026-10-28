<script lang="ts">
	import { onDestroy } from 'svelte';
	import { finishStudyBreakdown } from '@/composables/studyBreakdownSession.js';
	import DictionaryContent from '@/components/DictionaryContent/DictionaryContent.svelte';
	import DictionaryPopover from '@/components/DictionaryPopover/DictionaryPopover.svelte';
	import { createDictionaryPopover } from '@/composables/dictionaryPopover.svelte.js';
	import { breakdownSource } from '@/composables/breakdownTelemetry.js';
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import { mobileBreakdown } from '@/stores/mobileBreakdown.js';
	const source = breakdownSource(mobileBreakdown.origin ?? '');
	const dictionary = createDictionaryPopover(source === 'other' ? undefined : source);
	onDestroy(() => {
		dictionary.close();
		finishStudyBreakdown();
	});
	function back() {
		if (mobileBreakdown.origin !== undefined) {
			window.history.back();
		} else {
			window.location.hash = '#/';
		}
	}
</script>

<div class="mobile-breakdown">
	{#if mobileBreakdown.word}
		<DictionaryContent
			word={mobileBreakdown.word}
			lists={mobileBreakdown.lists}
			context="screen"
			initialSelection={mobileBreakdown.selection}
			onlink={dictionary.lookup}
			onexit={back}
		/>
	{:else}<SyButton onclick={back}>Back to dictionary</SyButton>
		<p>Choose a dictionary entry to view its character breakdown.</p>{/if}
</div>

<DictionaryPopover
	word={dictionary.word}
	results={dictionary.results}
	resultIndex={dictionary.resultIndex}
	anchor={dictionary.anchor}
	reopenKey={dictionary.reopenKey}
	lists={mobileBreakdown.lists}
	onselect={dictionary.select}
	onclose={dictionary.close}
	onlink={dictionary.lookup}
/>

<style>
	.mobile-breakdown {
		height: 100%;
		min-height: 0;
		background: var(--sy-color--white);
	}
</style>
