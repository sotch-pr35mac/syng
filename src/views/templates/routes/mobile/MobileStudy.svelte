<script lang="ts">
	import { onMount } from 'svelte';
	import StudyListItem from '@/components/StudyListItem/StudyListItem.svelte';
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import {
		createStudyListState,
		studySubRouteStore,
		studyOriginStore,
	} from '@/stores/studyRoute.svelte.js';
	import { flashcardsActiveListStore } from '@/stores/flashcards.svelte.js';
	import { studyHref, type StudyAction } from '@/composables/study.js';
	const studyLists = createStudyListState();
	const populatedLists = $derived(studyLists.lists);
	onMount(() => {
		if (studySubRouteStore.value === 'flashcards' && flashcardsActiveListStore.value) {
			window.location.hash = studyHref(
				'flashcards',
				flashcardsActiveListStore.value,
				studyOriginStore.value
			);
			return undefined;
		}
		void studyLists.load();
		return studyLists.cancel;
	});
	function handleSelection(event: { action: StudyAction; list: string }): void {
		studyOriginStore.set(null);
		window.location.hash = studyHref(event.action, event.list);
	}
</script>

<div class="mobile-study">
	<div class="mobile-study__content">
		{#if studyLists.status === 'loading'}
			<p>Loading...</p>
		{:else if studyLists.status === 'error'}
			<p>Unable to load your lists. Please try again.</p>
			<SyButton onclick={() => studyLists.load()}>Try again</SyButton>
		{:else if populatedLists.length}
			<div class="mobile-study__list">
				{#each populatedLists as list (list.name)}
					<StudyListItem value={list} variant="mobile" onselection={handleSelection} />
				{/each}
			</div>
		{:else}
			<div class="mobile-study__empty">
				<p>To study, add vocab words to your lists.</p>
			</div>
		{/if}
	</div>
</div>

<style>
	.mobile-study {
		height: 100%;
		overflow: hidden;
		background-color: var(--sy-color--grey-2);
	}

	.mobile-study__content {
		height: 100%;
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
		padding: var(--sy-mobile-space--large);
		box-sizing: border-box;
	}

	.mobile-study__list {
		display: flex;
		flex-direction: column;
		gap: calc(var(--sy-mobile-space--extra-small) * 5);
	}

	.mobile-study__empty {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: calc(var(--sy-mobile-space--medium) * 3);
		text-align: center;
		color: var(--sy-color--grey-4);
		font-family: var(--sy-font-family);
		font-size: var(--sy-font-size--mobile-medium);
	}
</style>
