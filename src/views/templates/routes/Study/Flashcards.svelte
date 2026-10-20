<script>
	import { ChevronLeft, ArrowLeft, ArrowRight, RotateCw, RotateCcw } from 'lucide-svelte';
	import { onMount } from 'svelte';
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import DictionaryContent from '@/components/DictionaryContent/DictionaryContent.svelte';
	import DictionaryPopover from '@/components/DictionaryPopover/DictionaryPopover.svelte';
	import { router } from 'svelte-spa-router';
	import { platform } from '@tauri-apps/plugin-os';
	import { scrollRestore } from '@/actions/scrollRestore.svelte.js';
	import { EMPTY_FLASHCARDS_LIST_MESSAGE, LOADING_STUDY_MESSAGE } from '@/composables/study.js';
	import { flashcardsRoute } from '@/composables/flashcards.svelte.js';
	import { isIPad } from '@/utils/device.js';
	import PreferredCharacters from '@/components/DictionaryContent/PreferredCharacters.svelte';
	const isMacos = platform() === 'macos';
	const isIPadDevice = isIPad();
	const params = new URLSearchParams(router.querystring);
	const listFromUrl = params.get('list');
	const lists = $derived(flashcardsRoute.lists);
	const activeWord = $derived(flashcardsRoute.activeWord);

	onMount(() => {
		flashcardsRoute.load(listFromUrl, params.get('from'));
		return flashcardsRoute.endSession;
	});

	// Derive left actions based on current state
	const leftActions = $derived([
		{
			icon: ChevronLeft,
			label: 'Exit',
			disabled: false,
			action: flashcardsRoute.exit,
		},
		{
			icon: ArrowLeft,
			label: 'Previous',
			disabled: !flashcardsRoute.canGoPrevious,
			action: flashcardsRoute.previous,
		},
	]);

	// Derive right actions based on current state
	const rightActions = $derived([
		{
			icon: flashcardsRoute.showDetails ? RotateCcw : RotateCw,
			label: 'Flip',
			disabled: false,
			action: flashcardsRoute.flip,
		},
		{
			icon: ArrowRight,
			label: 'Next',
			disabled: !flashcardsRoute.canGoNext,
			action: flashcardsRoute.next,
		},
	]);
</script>

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
						word={activeWord}
						backgroundColor="white"
						{lists}
						onlink={flashcardsRoute.lookupPopoverWord}
					/>
				</div>
			</div>
		{:else}
			<div class="flashcard--front">
				{#if flashcardsRoute.listContent.length > 0 && activeWord}
					<h1>
						<PreferredCharacters
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
