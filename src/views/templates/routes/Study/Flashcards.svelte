<script>
	import WalkthroughHelp from '@/components/Walkthrough/WalkthroughHelp.svelte';
	import WalkthroughFeatureInvitation from '@/components/Walkthrough/WalkthroughFeatureInvitation.svelte';

	import { ChevronLeft, ArrowLeft, ArrowRight, RotateCw, RotateCcw } from 'lucide-svelte';
	import { onDestroy, untrack } from 'svelte';
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import DictionaryContent from '@/components/DictionaryContent/DictionaryContent.svelte';
	import DictionaryPopover from '@/components/DictionaryPopover/DictionaryPopover.svelte';
	import { router } from 'svelte-spa-router';
	import { platform } from '@tauri-apps/plugin-os';
	import { scrollRestore } from '@/actions/scrollRestore.svelte.js';
	import { EMPTY_FLASHCARDS_LIST_MESSAGE, LOADING_STUDY_MESSAGE } from '@/composables/study.js';
	import { flashcardsRoute } from '@/composables/flashcards.svelte.js';
	import { isIPad } from '@/utils/device.js';
	import { pinyinSettingsStore } from '@/stores/pinyinSettings.svelte.js';
	import { dictionaryDisplaySettingsStore } from '@/stores/dictionaryDisplaySettings.svelte.js';
	import { lexicalPinyin } from '@/types/dictionary.js';
	import PreferredCharacters from '@/components/DictionaryContent/PreferredCharacters.svelte';
	const isMacos = platform() === 'macos';
	const isIPadDevice = isIPad();
	const listFromUrl = $derived(new URLSearchParams(router.querystring).get('list'));
	const originFromUrl = $derived(new URLSearchParams(router.querystring).get('from'));
	const lists = $derived(flashcardsRoute.lists);
	const activeWord = $derived(flashcardsRoute.activeWord);

	$effect(() => {
		// Route changes can arrive before unmount; exiting must not reload the saved list.
		if (router.location !== '/study/flashcards') {
			return;
		}
		const selectedList = listFromUrl;
		// Reload only when the list changes, preserving card navigation and flip state.
		untrack(() => flashcardsRoute.load(selectedList, originFromUrl));
	});
	onDestroy(flashcardsRoute.endSession);

	// Derive left actions based on current state
	const leftActions = $derived([
		{
			icon: ChevronLeft,
			label: 'Exit',
			guideTarget: 'study-exit',
			disabled: false,
			action: flashcardsRoute.exit,
		},
		{
			icon: ArrowLeft,
			label: 'Previous',
			guideTarget: 'flashcards-navigation',
			disabled: !flashcardsRoute.canGoPrevious,
			action: flashcardsRoute.previous,
		},
	]);

	// Derive right actions based on current state
	const rightActions = $derived([
		{
			icon: flashcardsRoute.showDetails ? RotateCcw : RotateCw,
			label: 'Flip',
			guideTarget: 'flashcards-flip',
			disabled: false,
			action: flashcardsRoute.flip,
		},
		{
			icon: ArrowRight,
			label: 'Next',
			guideTarget: 'flashcards-navigation',
			disabled: !flashcardsRoute.canGoNext,
			action: flashcardsRoute.next,
		},
	]);
</script>

<WalkthroughFeatureInvitation
	guide="flashcards"
	context={{ listName: listFromUrl ?? undefined }}
	ready={router.location === '/study/flashcards' &&
		!flashcardsRoute.loading &&
		!flashcardsRoute.error &&
		flashcardsRoute.activeList === listFromUrl &&
		Boolean(flashcardsRoute.activeWord)}
/>

<div class="flashcard--container">
	<p class="sy-sr-only" role="status" aria-atomic="true">
		{#if flashcardsRoute.loading}
			{LOADING_STUDY_MESSAGE}
		{:else if activeWord}
			Card {flashcardsRoute.activeIndex + 1} of {flashcardsRoute.listContent.length}. {flashcardsRoute.showDetails
				? 'Details shown.'
				: 'Front shown.'}
		{/if}
	</p>
	<div
		class="flashcard--header"
		class:flashcard--header--ipad={isIPadDevice}
		data-tauri-drag-region={isMacos ? true : undefined}
	>
		<div class="flashcard--header--section">
			{#each leftActions as action (action.label)}
				<SyButton
					guideTarget={action.guideTarget}
					disabled={action.disabled}
					onclick={action.action}
					style="ghost"
					center={true}
				>
					<action.icon />
					&nbsp;
					{action.label}
				</SyButton>
			{/each}
		</div>
		{#if !flashcardsRoute.loading && flashcardsRoute.listContent.length > 0}
			<div class="flashcard--status" data-testid="flashcard-status">
				<span class="flashcard--status--list">{flashcardsRoute.activeList}</span>
				<span class="flashcard--status--count">
					<span
						>· {flashcardsRoute.activeIndex + 1} of {flashcardsRoute.listContent
							.length}</span
					>
					{#if !flashcardsRoute.canGoNext}
						<span>· Last card</span>
					{/if}
				</span>
			</div>
		{/if}
		<div class="flashcard--header--section">
			{#each rightActions as action (action.label)}
				<SyButton
					guideTarget={action.guideTarget}
					disabled={action.disabled}
					onclick={action.action}
					style="ghost"
					center={true}
				>
					{action.label}
					&nbsp;
					<action.icon />
				</SyButton>
			{/each}
		</div>
	</div>
	<div class="flashcard--content" use:scrollRestore={'flashcard-content'}>
		{#if flashcardsRoute.showDetails && activeWord}
			<div class="flashcard--back">
				<div class="flashcard--back--container">
					<DictionaryContent
						context="page"
						word={activeWord}
						backgroundColor="white"
						{lists}
						onlink={flashcardsRoute.lookupPopoverWord}
					/>
				</div>
			</div>
		{:else}
			<div class="flashcard--front" class:flashcard--empty={!flashcardsRoute.activeWord}>
				{#if flashcardsRoute.listContent.length > 0 && activeWord}
					<h1>
						<PreferredCharacters
							pinyin={pinyinSettingsStore.showFlashcardPinyin
								? lexicalPinyin(activeWord)
								: undefined}
							colorPinyinByTone={dictionaryDisplaySettingsStore.settings
								.colorPinyinByTone}
							simplified={activeWord.simplified}
							traditional={activeWord.traditional}
							lexicalTestIdPrefix="flashcard-front"
						/>
					</h1>
				{:else}
					<h1>
						{flashcardsRoute.loading
							? LOADING_STUDY_MESSAGE
							: flashcardsRoute.error
								? 'Unable to load flashcards. Please try again.'
								: EMPTY_FLASHCARDS_LIST_MESSAGE}
					</h1>
				{/if}
				{#if !flashcardsRoute.loading && !flashcardsRoute.error && !flashcardsRoute.listContent.length}
					<WalkthroughHelp
						guide="flashcards"
						label="Learn how flashcards work"
						context={{ listName: listFromUrl ?? undefined }}
					/>
				{/if}
			</div>
		{/if}
	</div>
</div>

<DictionaryPopover
	word={flashcardsRoute.popoverWord}
	results={flashcardsRoute.popoverResults}
	resultIndex={flashcardsRoute.popoverResultIndex}
	{lists}
	anchor={flashcardsRoute.popoverAnchor}
	reopenKey={flashcardsRoute.popoverReopenKey}
	onselect={flashcardsRoute.selectPopoverResult}
	onlink={flashcardsRoute.lookupPopoverWord}
	onclose={flashcardsRoute.closePopoverDictionary}
/>

<style>
	.flashcard--container {
		display: flex;
		flex-direction: column;
		height: 100vh;
		width: 100%;
	}
	.flashcard--header {
		flex-wrap: wrap;
		display: flex;
		padding: var(--sy-space--extra-large) var(--sy-space--large);
		margin: 0;
		background-color: var(--sy-color--white);
		box-shadow: var(--sy-box-shadow);
		z-index: var(--sy-z-index--base-2);
		align-items: center;
		justify-content: space-between;
	}
	.flashcard--header--ipad {
		padding-top: max(var(--sy-space--large), env(safe-area-inset-top, 0px));
		padding-bottom: var(--sy-space--large);
	}
	.flashcard--header--section {
		flex-wrap: wrap;
		display: flex;
		flex-shrink: 0;
		align-items: center;
		justify-content: space-around;
	}
	.flashcard--status {
		display: flex;
		flex: 1;
		min-width: 0;
		justify-content: center;
		gap: var(--sy-space--small);
		margin: 0 var(--sy-space--large);
		color: var(--sy-color--grey-5);
		font-size: var(--sy-font-size--small);
	}
	.flashcard--status--list {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.flashcard--status--count {
		min-width: min-content;
		text-align: center;
	}
	.flashcard--status--count > span {
		white-space: nowrap;
	}
	.flashcard--content {
		display: flex;
		background-color: var(--sy-color--white);
		width: 100%;
		height: 100%;
		overflow-y: auto;
		overflow-x: hidden;
		z-index: var(--sy-z-index--base-1);
	}
	.flashcard--front {
		flex-direction: column;
		gap: var(--sy-space--large);
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
	}
	.flashcard--front h1 {
		font-size: var(--sy-font-size--display-large);
		font-weight: 200;
		margin-bottom: 83px;
	}
	.flashcard--empty h1 {
		margin-bottom: var(--sy-space--large);
	}
	.flashcard--back {
		margin: var(--sy-space--large) var(--sy-space--extra-large);
		width: 100%;
		display: flex;
		justify-content: center;
	}
	.flashcard--back--container {
		width: 100%;
		display: flex;
	}
</style>
