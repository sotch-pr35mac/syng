<script>
	import SyList from '../components/SyList/SyList.svelte';
	import StudyListItem from '../components/StudyListItem/StudyListItem.svelte';
	import { handleError } from '../utils';

	const isMacos = window.platform === 'darwin';
	let lists = [];
	let emptyLists = [];
	let populatedLists = [];
	window.bookmarkManager
		.getLists()
		.then((wordLists) => {
			lists = wordLists.sort((a, b) => a.localeCompare(b));
		})
		.catch((e) => {
			handleError(
				'There was an error fetching word lists. Check the logs for more details.',
				e,
			);
		});
	window.bookmarkManager
		.getEmptyLists()
		.then((lists) => {
			emptyLists = lists;
		})
		.catch((e) => {
			handleError(
				'There was an error fetching the empty lists. Check the log for more details.',
				e,
			);
		});

	$: populatedLists = lists.filter((list) => !emptyLists.includes(list));

	const handleSelection = (list) => {
		const url = `#/study/flashcards?list=${list.detail}`;
		document.location.href = url;
	};
</script>

<div class="study--container">
	<div
		class="study--title"
		data-tauri-drag-region={isMacos ? true : undefined}
	>
		<h1 data-tauri-drag-region={isMacos ? true : undefined}>Study</h1>
	</div>
	<div class="study--content">
		{#if populatedLists.length}
			<SyList
				values={populatedLists}
				component={StudyListItem}
				on:selection={handleSelection}
			/>
		{:else}
			<div class="study--empty">
				<span>
					To take a quiz or study flashcards, add vocab words to your
					lists.
				</span>
			</div>
		{/if}
	</div>
</div>

<style>
	.study--container {
		padding: 0px var(--sy-space--extra-large);
		background-color: var(--sy-color--white);
		overflow: hidden;
		width: 100%;
	}
	.study--title {
		padding: var(--sy-space--extra-large) var(--sy-space);
	}
	.study--empty {
		display: flex;
		justify-content: center;
	}
</style>
