<script lang="ts">
	import { onMount } from 'svelte';
	import StudyListItem from '@/components/StudyListItem/StudyListItem.svelte';
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import { Search } from 'lucide-svelte';
	import Awa, { AWA_SIZES } from '@/components/Awa/Awa.svelte';
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
	<div
		class="mobile-study__content"
		class:mobile-study__content--empty={studyLists.status === 'ready' && !populatedLists.length}
	>
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
				<div class="mobile-study__empty-copy">
					<Awa pose="practice" size={AWA_SIZES.mobile} />
					<p>Add words to a list to start studying.</p>
				</div>
				<SyButton
					size="large"
					classes={['mobile-study__empty-action']}
					onclick={() => (window.location.hash = '#/')}
				>
					<Search size="20" />
					<span>Search for words</span>
				</SyButton>
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
		flex-direction: column;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--sy-mobile-space--large);
		width: 100%;
		text-align: center;
		color: var(--sy-color--grey-4);
		font-family: var(--sy-font-family);
		font-size: var(--sy-font-size--mobile-medium);
	}

	.mobile-study__content--empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding-bottom: calc(var(--sy-mobile-space--large) + env(safe-area-inset-bottom, 0px));
	}

	/* Keep the upward adjustment proportional to the available space on small screens. */
	.mobile-study__content--empty::before,
	.mobile-study__content--empty::after {
		content: '';
		flex: 2;
	}

	.mobile-study__content--empty::after {
		flex: 3;
	}

	.mobile-study__empty-copy {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--sy-mobile-space--medium);
	}

	.mobile-study__empty p {
		margin: 0;
	}

	:global(.mobile-study__empty-action) {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--sy-mobile-space--medium);
		margin: 0;
	}
</style>
