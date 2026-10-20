<script lang="ts">
	import { walkthroughTarget } from '@/actions/walkthroughTarget.svelte.js';
	import { walkthroughStore } from '@/stores/walkthrough.svelte.js';
	import WalkthroughHelp from '@/components/Walkthrough/WalkthroughHelp.svelte';

	import SyList from '@/components/SyList/SyList.svelte';
	import { platform } from '@tauri-apps/plugin-os';
	import { isIPad } from '@/utils/device.js';
	import { onMount, untrack } from 'svelte';
	import { bookmarksStore } from '@/stores/bookmarks.svelte.js';
	import StudyListItem from '@/components/StudyListItem/StudyListItem.svelte';
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import { Search } from 'lucide-svelte';
	import Awa from '@/components/Awa/Awa.svelte';
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
		if (
			!walkthroughStore.isOverview('/study') &&
			studySubRouteStore.value === 'flashcards' &&
			flashcardsActiveListStore.value
		) {
			window.location.hash = studyHref(
				'flashcards',
				flashcardsActiveListStore.value,
				studyOriginStore.value
			);
		}
	});
	$effect(() => {
		void bookmarksStore.contentRevision;
		untrack(() => {
			void studyLists.load();
		});
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
	<div
		use:walkthroughTarget={walkthroughStore.guide === 'app' && !populatedLists.length
			? undefined
			: 'study-lists'}
		class="study--content"
		class:study--content-empty={studyLists.status === 'ready' && !populatedLists.length}
	>
		{#if studyLists.status === 'loading'}
			<p>Loading...</p>
		{:else if studyLists.status === 'error'}
			<p>Unable to load your lists. Please try again.</p>
			<SyButton onclick={() => studyLists.load()}>Try again</SyButton>
		{:else if populatedLists.length}
			<div class="study--help">
				<WalkthroughHelp guide="study" label="Learn how Study works" />
			</div>
			<SyList
				values={populatedLists}
				component={StudyListItem}
				onselection={handleSelection}
			/>
		{:else}
			<div class="study--empty">
				<div class="study--empty-copy">
					<Awa pose="practice" />
					<p>Add words to a list to start studying.</p>
				</div>
				<SyButton
					size="large"
					classes={['study--empty-action']}
					onclick={() => (window.location.hash = '#/')}
				>
					<Search size="20" />
					<span>Search for words</span>
				</SyButton>
				<WalkthroughHelp guide="study" label="Learn how Study works" />
			</div>
		{/if}
	</div>
</div>

<style>
	.study--help {
		text-align: center;
	}

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
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--sy-space--extra-large);
		width: 100%;
		color: var(--sy-color--grey-4);
		font-family: var(--sy-font-family);
		text-align: center;
	}
	.study--content-empty {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: var(--sy-space--extra-large) var(--sy-space--large);
		/* Balance the title above the empty state. */
		padding-bottom: calc(var(--sy-space--extra-large) + min(12vh, 100px));
		box-sizing: border-box;
	}
	.study--empty-copy {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--sy-space--large);
	}
	.study--empty p {
		margin: 0;
	}
	:global(.study--empty-action) {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--sy-space);
		margin: 0;
	}
</style>
