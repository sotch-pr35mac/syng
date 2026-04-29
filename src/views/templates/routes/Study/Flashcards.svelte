<script>
	import { ChevronLeft, ArrowLeft, ArrowRight, RotateCw, RotateCcw } from 'lucide-svelte';
	import { onMount } from 'svelte';
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import DictionaryContent from '@/components/DictionaryContent/DictionaryContent.svelte';
	import { querystring } from 'svelte-spa-router';
	import { platform } from '@tauri-apps/plugin-os';
	import { scrollRestore } from '@/actions/scrollRestore.svelte.js';
	import { EMPTY_FLASHCARDS_LIST_MESSAGE, LOADING_STUDY_MESSAGE } from '@/composables/study.js';
	import { flashcardsRoute } from '@/composables/flashcards.svelte.js';
	const isMacos = platform() === 'macos';
	const params = new URLSearchParams($querystring);
	const listFromUrl = params.get('list');
	const lists = $derived(flashcardsRoute.lists);
	const activeWord = $derived(flashcardsRoute.activeWord);

	onMount(() => {
		flashcardsRoute.load(listFromUrl);
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
	<div class="flashcard--header" data-tauri-drag-region={isMacos ? true : undefined}>
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
		{#if flashcardsRoute.showDetails}
			<div class="flashcard--back">
				<div class="flashcard--back--container">
					<DictionaryContent word={activeWord} backgroundColor="white" {lists} />
				</div>
			</div>
		{:else}
			<div class="flashcard--front">
				{#if flashcardsRoute.listContent.length > 0 && activeWord}
					<h1>
						{activeWord.simplified}&nbsp;({activeWord.traditional})
					</h1>
				{:else}
					<h1>
						{flashcardsRoute.loading
							? LOADING_STUDY_MESSAGE
							: EMPTY_FLASHCARDS_LIST_MESSAGE}
					</h1>
				{/if}
			</div>
		{/if}
	</div>
</div>

<style>
	.flashcard--container {
		display: flex;
		flex-direction: column;
		height: 100vh;
		width: 100%;
	}
	.flashcard--header {
		display: flex;
		padding: var(--sy-space--extra-large) var(--sy-space--large);
		margin: 0;
		background-color: var(--sy-color--white);
		box-shadow: var(--sy-box-shadow);
		z-index: var(--sy-z-index--base-2);
		align-items: center;
		justify-content: space-between;
	}
	.flashcard--header--section {
		display: flex;
		align-items: center;
		justify-content: space-around;
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
