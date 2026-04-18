<script lang="ts">
	import { onMount } from 'svelte';
	import StudyListItem from '../../components/StudyListItem/StudyListItem.svelte';
	import { bookmarksStore } from '../../stores/bookmarks.svelte.js';
	import { flashcardsActiveListStore } from '../../stores/flashcards.svelte.js';
	import { studySubRouteStore } from '../../stores/studyRoute.svelte.js';
	import { handleError } from '../../utils/index.js';

	let emptyLists = $state<string[]>([]);

	const lists = $derived([...bookmarksStore.lists].sort((a, b) => a.localeCompare(b)));
	const populatedLists = $derived(lists.filter((list) => !emptyLists.includes(list)));

	onMount(() => {
		if (studySubRouteStore.value === 'flashcards' && flashcardsActiveListStore.value) {
			window.location.hash = `#/study/flashcards?list=${encodeURIComponent(flashcardsActiveListStore.value)}`;
			return;
		}

		bookmarksStore
			.getEmptyLists()
			.then((fetchedLists) => {
				emptyLists = fetchedLists;
				return undefined;
			})
			.catch((error) => {
				handleError(
					'There was an error fetching the empty lists. Check the log for more details.',
					error
				);
			});
	});

	function handleSelection(event: { action: string; list: string }): void {
		const route = event.action === 'quiz' ? 'quiz' : 'flashcards';
		window.location.hash = `#/study/${route}?list=${encodeURIComponent(event.list)}`;
	}
</script>

<div class="mobile-study">
	<div class="mobile-study__content">
		{#if populatedLists.length}
			<div class="mobile-study__list">
				{#each populatedLists as list (list)}
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
