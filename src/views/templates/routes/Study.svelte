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
		// Refresh on bookmark mutations only; load() also reads/writes its own reactive status.
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
			<div class="study--practice">
				<div class="study--collection-heading">
					<div>
						<h2>Ready to practice</h2>
						<p>Choose a saved list, then a way to practice.</p>
					</div>
					<span
						>{populatedLists.length}
						{populatedLists.length === 1 ? 'list' : 'lists'}</span
					>
				</div>
				<div class="study--help">
					<WalkthroughHelp guide="study" label="Learn how Study works" />
				</div>
				<SyList
					values={populatedLists}
					component={StudyListItem}
					onselection={handleSelection}
				/>
			</div>
		{:else}
			<div class="study--empty">
				<div class="study--empty-copy">
					<Awa pose="practice" />
					<h2>No words to study yet</h2>
					<p>Save words in Search or Reader to start practicing.</p>
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
		margin-top: var(--sy-space--extra-large);
	}

	.study--container {
		display: flex;
		flex-direction: column;
		background-color: var(--sy-surface--canvas);
		overflow: hidden;
		width: 100%;
	}
	.study--title {
		display: flex;
		align-items: center;
		min-height: var(--sy-desktop-page-header-min-height);
		box-sizing: border-box;
		padding: var(--sy-space--extra-large) var(--sy-space--large);
		background-color: var(--sy-surface--chrome);
		box-shadow: var(--sy-box-shadow);
		z-index: var(--sy-z-index--base-2);
	}
	.study--title--ipad {
		padding-top: max(var(--sy-space--large), env(safe-area-inset-top, 0px));
		padding-bottom: var(--sy-space--large);
	}
	.study--title h1 {
		margin: 0;
		color: var(--sy-color--black);
		font-size: var(--sy-font-size--large);
		font-weight: var(--sy-font-weight--bold);
		overflow-wrap: anywhere;
	}
	.study--content {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		overflow-x: hidden;
		padding: var(--sy-space--extra-large);
		box-sizing: border-box;
		background-color: var(--sy-surface--canvas);
		background-image: var(--sy-surface--canvas-texture);
		background-blend-mode: var(--sy-surface--canvas-texture-blend);
	}
	.study--practice {
		width: 100%;
		max-width: var(--sy-study-collection-max-width);
		margin: 0 auto;
	}
	.study--collection-heading {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: var(--sy-space--large);
		padding: 0 var(--sy-space--extra-large);
		color: var(--sy-color--black);
	}
	.study--collection-heading h2 {
		margin: 0;
		font: var(--sy-type--local-title);
	}
	.study--collection-heading p,
	.study--collection-heading span {
		margin: var(--sy-space) 0 0;
		font: var(--sy-type--supporting);
		color: var(--sy-text--secondary);
	}
	.study--collection-heading span {
		flex-shrink: 0;
	}
	.study--empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--sy-space--extra-large);
		width: 100%;
		color: var(--sy-text--muted);
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
	.study--empty h2 {
		margin: 0;
		font: var(--sy-type--local-title);
		color: var(--sy-color--black);
	}
	.study--empty p {
		margin: 0;
		max-width: var(--sy-study-empty-copy-max-width);
		font: var(--sy-type--supporting);
		color: var(--sy-text--secondary);
	}
	:global(.study--empty-action) {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--sy-space);
		margin: 0;
	}
</style>
