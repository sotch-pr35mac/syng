<script lang="ts">
	import { ArrowLeft, ArrowRight, RotateCcw, RotateCw, X } from 'lucide-svelte';
	import { querystring } from 'svelte-spa-router';
	import { onMount } from 'svelte';
	import SyButton from '../../components/SyButton/SyButton.svelte';
	import DictionaryContent from '../../components/DictionaryContent/DictionaryContent.svelte';
	import { scrollRestore } from '../../actions/scrollRestore.svelte.js';
	import {
		EMPTY_FLASHCARDS_LIST_MESSAGE,
		LOADING_STUDY_MESSAGE,
	} from '../../composables/study.js';
	import { flashcardsRoute } from '../../composables/flashcards.svelte.js';

	const params = new URLSearchParams($querystring);
	const listFromUrl = params.get('list');

	const lists = $derived(flashcardsRoute.lists);
	const activeWord = $derived(flashcardsRoute.activeWord);
	const canGoPrevious = $derived(flashcardsRoute.canGoPrevious);
	const canGoNext = $derived(flashcardsRoute.canGoNext);
	const actions = $derived([
		{
			icon: ArrowLeft,
			label: 'Previous',
			disabled: !canGoPrevious,
			action: flashcardsRoute.previous,
			classes: ['mobile-flashcards__bar-button'],
			iconAfter: false,
		},
		{
			icon: flashcardsRoute.showDetails ? RotateCcw : RotateCw,
			label: 'Flip',
			disabled: false,
			action: flashcardsRoute.flip,
			classes: ['mobile-flashcards__bar-button', 'mobile-flashcards__flip-button'],
			iconAfter: false,
		},
		{
			icon: ArrowRight,
			label: 'Next',
			disabled: !canGoNext,
			action: flashcardsRoute.next,
			classes: ['mobile-flashcards__bar-button'],
			iconAfter: true,
		},
	]);

	onMount(() => {
		flashcardsRoute.load(listFromUrl);
	});
</script>

<div class="mobile-flashcards">
	<div class="mobile-flashcards__content" use:scrollRestore={'mobile-flashcards-content'}>
		{#if flashcardsRoute.showDetails && activeWord}
			<div class="mobile-flashcards__back">
				<DictionaryContent word={activeWord} backgroundColor="white" {lists} />
			</div>
		{:else}
			<div class="mobile-flashcards__front">
				<h1>
					{#if activeWord}
						{activeWord.simplified}
						{#if activeWord.simplified !== activeWord.traditional}
							<span>({activeWord.traditional})</span>
						{/if}
					{:else}
						{flashcardsRoute.loading
							? LOADING_STUDY_MESSAGE
							: EMPTY_FLASHCARDS_LIST_MESSAGE}
					{/if}
				</h1>
			</div>
		{/if}
	</div>

	<div class="mobile-flashcards__bar">
		<div class="mobile-flashcards__exit-row">
			<SyButton
				style="ghost"
				size="large"
				center={true}
				onclick={flashcardsRoute.exit}
				classes={['mobile-flashcards__exit-button']}
			>
				<X size="18" />
				<span>Exit</span>
			</SyButton>
		</div>

		<div class="mobile-flashcards__actions-row">
			{#each actions as action (action.label)}
				<SyButton
					style="ghost"
					size="large"
					center={true}
					disabled={action.disabled}
					onclick={action.action}
					classes={action.classes}
				>
					{#if action.iconAfter}
						<span>{action.label}</span>
						<action.icon size="20" />
					{:else}
						<action.icon size="20" />
						<span>{action.label}</span>
					{/if}
				</SyButton>
			{/each}
		</div>
	</div>
</div>

<style>
	.mobile-flashcards {
		position: relative;
		display: flex;
		flex-direction: column;
		height: 100%;
		overflow: hidden;
		background-color: var(--sy-color--white);
	}

	.mobile-flashcards__content {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		overflow-x: hidden;
		-webkit-overflow-scrolling: touch;
		padding-bottom: calc(126px + env(safe-area-inset-bottom));
		box-sizing: border-box;
	}

	.mobile-flashcards__front {
		min-height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: var(--sy-mobile-space--extra-large) calc(var(--sy-mobile-space--medium) * 3);
		box-sizing: border-box;
		text-align: center;
	}

	.mobile-flashcards__front h1 {
		margin: 0;
		font-size: var(--sy-font-size--display-large);
		font-weight: 200;
		line-height: 1.2;
		overflow-wrap: anywhere;
	}

	.mobile-flashcards__front span {
		display: block;
		margin-top: calc(var(--sy-mobile-space--extra-small) * 5);
		font-size: var(--sy-font-size--display-medium);
		color: var(--sy-color--grey-5);
	}

	.mobile-flashcards__back {
		min-height: 100%;
		background-color: var(--sy-color--white);
	}

	.mobile-flashcards__back :global(.dictionary-content-container) {
		min-height: 100%;
		background-color: var(--sy-color--white);
	}

	.mobile-flashcards__bar {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		display: flex;
		flex-direction: column;
		gap: var(--sy-mobile-space--small);
		padding: calc(var(--sy-mobile-space--extra-small) * 3)
			calc(var(--sy-mobile-space--extra-small) * 7)
			max(calc(var(--sy-mobile-space--extra-small) * 5), env(safe-area-inset-bottom));
		background-color: var(--sy-color--white);
		border-top: var(--sy-border);
		box-shadow: var(--sy-mobile-dock-shadow);
		box-sizing: border-box;
		z-index: var(--sy-z-index--base-2);
	}

	.mobile-flashcards__exit-row {
		display: flex;
		justify-content: center;
		min-height: var(--sy-mobile-bar-exit-row-height);
		border-bottom: var(--sy-border);
	}

	.mobile-flashcards__actions-row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr);
		align-items: center;
		gap: calc(var(--sy-mobile-space--extra-small) * 3);
		min-height: var(--sy-mobile-bar-actions-row-height);
	}

	:global(.mobile-flashcards__exit-button) {
		gap: calc(var(--sy-mobile-space--extra-small) * 3);
		width: 100%;
		margin: 0;
		color: var(--sy-color--grey-5);
	}

	:global(.mobile-flashcards__bar-button) {
		gap: calc(var(--sy-mobile-space--extra-small) * 3);
		margin: 0;
		color: var(--sy-color--grey-6);
		white-space: nowrap;
	}

	:global(.mobile-flashcards__flip-button) {
		color: var(--sy-color--blue);
	}
</style>
