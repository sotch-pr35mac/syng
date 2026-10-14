<script lang="ts">
	import SyList from '@/components/SyList/SyList.svelte';
	import { platform } from '@tauri-apps/plugin-os';
	import { isIPad } from '@/utils/device.js';
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
	const isMacos = platform() === 'macos';
	const isIPadDevice = isIPad();
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
		{#if studyLists.status === 'loading'}
			<p>Loading...</p>
		{:else if studyLists.status === 'error'}
			<p>Unable to load your lists. Please try again.</p>
			<SyButton onclick={() => studyLists.load()}>Try again</SyButton>
		{:else if populatedLists.length}
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
		display: flex;
		flex-direction: column;
		padding: 0px var(--sy-space--extra-large);
		background-color: var(--sy-color--white);
		overflow: hidden;
		width: 100%;
	}
	.study--title {
		padding: var(--sy-space--extra-large) var(--sy-space);
	}
	.study--title--ipad {
		padding-top: max(var(--sy-space--large), env(safe-area-inset-top, 0px));
		padding-bottom: var(--sy-space--large);
	}
	.study--content {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		overflow-x: hidden;
	}
	.study--empty {
		display: flex;
		justify-content: center;
	}
</style>
