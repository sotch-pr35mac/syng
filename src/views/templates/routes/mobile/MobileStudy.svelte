<script lang="ts">
	import { walkthroughTarget } from '@/actions/walkthroughTarget.svelte.js';
	import { walkthroughStore } from '@/stores/walkthrough.svelte.js';
	import WalkthroughHelp from '@/components/Walkthrough/WalkthroughHelp.svelte';

	import { onMount, untrack } from 'svelte';
	import { bookmarksStore } from '@/stores/bookmarks.svelte.js';
	import StudyListItem from '@/components/StudyListItem/StudyListItem.svelte';
	import SyListContent from '@/components/SyList/SyListContent.svelte';
	import SyListItem from '@/components/SyList/SyListItem.svelte';
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
		// Track membership changes, not the loader’s own reactive status.
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
</script>

<div class="mobile-study">
	<div
		use:walkthroughTarget={walkthroughStore.guide === 'app' && !populatedLists.length
			? undefined
			: 'study-lists'}
		class="mobile-study__content"
		data-sy-primary-scroll
		class:mobile-study__content--empty={studyLists.status === 'ready' && !populatedLists.length}
	>
		{#if studyLists.status === 'loading'}
			<p>Loading...</p>
		{:else if studyLists.status === 'error'}
			<p>Unable to load your lists. Please try again.</p>
			<SyButton onclick={() => studyLists.load()}>Try again</SyButton>
		{:else if populatedLists.length}
			<div class="mobile-study__practice">
				<div class="mobile-study__collection-heading">
					<div>
						<h2>Ready to practice</h2>
						<p>Choose a list and how to practice.</p>
					</div>
					<span
						>{populatedLists.length}
						{populatedLists.length === 1 ? 'list' : 'lists'}</span
					>
				</div>
				<div class="mobile-study__help">
					<WalkthroughHelp guide="study" label="Learn how Study works" />
				</div>
				<SyListContent>
					{#each populatedLists as list (list.name)}
						<SyListItem>
							<StudyListItem
								value={list}
								variant="mobile"
								onselection={handleSelection}
							/>
						</SyListItem>
					{/each}
				</SyListContent>
			</div>
		{:else}
			<div class="mobile-study__empty">
				<div class="mobile-study__empty-copy">
					<Awa pose="practice" size={AWA_SIZES.mobile} />
					<h2>Make your saved words useful</h2>
					<p>Save words from Search or Reader, then practice them here.</p>
				</div>
				<SyButton
					size="large"
					classes={['mobile-study__empty-action']}
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
	.mobile-study__help {
		text-align: center;
		margin-top: var(--sy-mobile-space--large);
	}

	.mobile-study {
		display: flex;
		flex-direction: column;
		height: 100%;
		overflow: hidden;
		background-color: var(--sy-surface--canvas);
		background-image: var(--sy-surface--canvas-texture);
		background-blend-mode: var(--sy-surface--canvas-texture-blend);
	}

	.mobile-study__content {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
		padding: var(--sy-mobile-space--large);
		box-sizing: border-box;
	}
	.mobile-study__practice {
		width: 100%;
		max-width: var(--sy-study-collection-max-width);
		margin: 0 auto;
	}
	.mobile-study__collection-heading {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: var(--sy-mobile-space--medium);
		color: var(--sy-color--black);
	}
	.mobile-study__collection-heading h2 {
		margin: 0;
		font: var(--sy-type--local-title-mobile);
	}
	.mobile-study__collection-heading p,
	.mobile-study__collection-heading span {
		margin: var(--sy-mobile-space--small) 0 0;
		font: var(--sy-type--supporting-mobile);
		color: var(--sy-text--secondary);
	}
	.mobile-study__collection-heading span {
		flex-shrink: 0;
	}

	.mobile-study__empty {
		flex-direction: column;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--sy-mobile-space--large);
		width: 100%;
		text-align: center;
		color: var(--sy-text--muted);
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
	.mobile-study__empty h2 {
		margin: 0;
		font: var(--sy-type--local-title-mobile);
		color: var(--sy-color--black);
	}
	.mobile-study__empty p {
		margin: 0;
		max-width: var(--sy-study-empty-copy-max-width);
		font: var(--sy-type--supporting-mobile);
		color: var(--sy-text--secondary);
	}

	:global(.mobile-study__empty-action) {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--sy-mobile-space--medium);
		margin: 0;
	}
</style>
