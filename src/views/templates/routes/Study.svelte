<script>
	import { onMount } from 'svelte';
	import SyList from '../components/SyList/SyList.svelte';
	import StudyListItem from '../components/StudyListItem/StudyListItem.svelte';
	import { handleError } from '../utils';
	import { platform } from '@tauri-apps/plugin-os';
	import { bookmarksStore } from '../stores/bookmarks.svelte.js';
	import { studySubRouteStore } from '../stores/studyRoute.svelte.js';
	import { flashcardsActiveListStore } from '../stores/flashcards.svelte.js';
	import { isIPad } from '../utils/device.js';

	const isMacos = platform() === 'macos';
	const isIPadDevice = isIPad();
	let emptyLists = $state([]);

	onMount(() => {
		if (studySubRouteStore.value === 'flashcards' && flashcardsActiveListStore.value) {
			window.location.hash = `#/study/flashcards?list=${flashcardsActiveListStore.value}`;
		}
	});

	// List names come reactively from the shared bookmarks store; only emptyLists needs
	// to be fetched here because it scans list contents which are not cached.
	const lists = $derived([...bookmarksStore.lists].sort((a, b) => a.localeCompare(b)));
	const populatedLists = $derived(lists.filter((list) => !emptyLists.includes(list)));

	bookmarksStore
		.getEmptyLists()
		.then((fetchedLists) => {
			emptyLists = fetchedLists;
			return undefined;
		})
		.catch((e) => {
			handleError(
				'There was an error fetching the empty lists. Check the log for more details.',
				e
			);
		});

	const handleSelection = (data) => {
		const { list, action } = data;
		let url;
		if (action === 'quiz') {
			url = `#/study/quiz?list=${list}`;
		} else {
			url = `#/study/flashcards?list=${list}`;
		}
		document.location.href = url;
	};
</script>

<div class="study--container">
	<div
		class="study--title"
		class:study--title--ipad={isIPadDevice}
		data-tauri-drag-region={isMacos ? true : undefined}
	>
		<h1 data-tauri-drag-region={isMacos ? true : undefined}>Study</h1>
	</div>
	<div class="study--content">
		{#if populatedLists.length}
			<SyList
				values={populatedLists}
				component={StudyListItem}
				onselection={handleSelection}
			/>
		{:else}
			<div class="study--empty">
				<span> To take a quiz or study flashcards, add vocab words to your lists. </span>
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
	.study--title--ipad {
		padding-top: var(--sy-space--large);
		padding-bottom: var(--sy-space--large);
	}
	.study--empty {
		display: flex;
		justify-content: center;
	}
</style>
