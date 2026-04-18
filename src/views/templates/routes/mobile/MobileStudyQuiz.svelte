<script lang="ts">
	import { ArrowRight, RotateCw, SquareStack, X } from 'lucide-svelte';
	import { querystring } from 'svelte-spa-router';
	import { onDestroy, onMount } from 'svelte';
	import { fly } from 'svelte/transition';
	import SyButton from '../../components/SyButton/SyButton.svelte';
	import DictionaryContent from '../../components/DictionaryContent/DictionaryContent.svelte';
	import MobileTimer from '../../components/MobileTimer/MobileTimer.svelte';
	import SyProgressLine from '../../components/SyProgressLine/SyProgressLine.svelte';
	import ResultIndicator from '../../components/ResultIndicator/ResultIndicator.svelte';
	import QuizResults from '../../components/QuizResults/QuizResults.svelte';
	import {
		CHARACTER_QUESTIONS,
		EMPTY_QUIZ_MESSAGE,
		LOADING_STUDY_MESSAGE,
		QUIZ_RESULT_DISPLAY_TIME,
	} from '../../composables/study.js';
	import { quizRoute } from '../../composables/quiz.svelte.js';

	const RESULT_TOAST_DISPLAY_TIME = 3000;
	const TIMER_SIZE = 44;

	const params = new URLSearchParams($querystring);
	const activeList = params.get('list');

	let showResultToast = $state(false);
	let timerRef = $state<any>(undefined);
	let resultToastTimeout: ReturnType<typeof setTimeout> | undefined;
	const finalActions = $derived([
		{
			icon: RotateCw,
			label: 'Retake',
			action: retakeQuiz,
			classes: ['mobile-quiz__bar-button'],
			iconAfter: false,
			align: 'left',
		},
		{
			icon: SquareStack,
			label: 'Flashcards',
			action: studyFlashcards,
			classes: ['mobile-quiz__bar-button'],
			iconAfter: true,
			align: 'right',
		},
	]);
	const isCharacterQuestion = $derived(quizRoute.currentQuestion?.kind === CHARACTER_QUESTIONS);
	const continueAction = $derived({
		icon: ArrowRight,
		label: quizRoute.continueLabel,
		action: continueQuiz,
		classes: ['mobile-quiz__continue-button'],
		iconAfter: true,
	});

	onMount(() => {
		quizRoute.start(activeList);
	});

	onDestroy(() => {
		hideResultToast();
	});

	function hideResultToast(): void {
		showResultToast = false;
		if (resultToastTimeout) {
			clearTimeout(resultToastTimeout);
			resultToastTimeout = undefined;
		}
	}

	function showTemporaryResultToast(): void {
		hideResultToast();
		showResultToast = true;
		resultToastTimeout = setTimeout(() => {
			showResultToast = false;
			resultToastTimeout = undefined;
		}, RESULT_TOAST_DISPLAY_TIME);
	}

	function answerQuestion(response: string): void {
		quizRoute
			.answerQuestion(response)
			.then((answered) => {
				if (answered) {
					showTemporaryResultToast();
				}
				return undefined;
			})
			.catch(() => {});
	}

	function handleQuestionTimerComplete(): void {
		answerQuestion('N/A');
	}

	function continueQuiz(): void {
		hideResultToast();
		quizRoute.continue();
		timerRef = undefined;
	}

	function handleResultTimerComplete(): void {
		quizRoute.showResult = false;
		hideResultToast();
		if (quizRoute.showAnswer) {
			continueQuiz();
		}
	}

	function handlePageClick(event: MouseEvent | KeyboardEvent): void {
		const target = event.target;
		if (!(target instanceof Element)) {
			return;
		}
		if (target.closest('.mobile-timer')) {
			return;
		}
		if (
			quizRoute.showResult ||
			(quizRoute.question && !quizRoute.showAnswer && !quizRoute.showFinalResults)
		) {
			timerRef?.pause();
		}
	}

	function exitQuiz(): void {
		hideResultToast();
		quizRoute.exit();
	}

	function retakeQuiz(): void {
		hideResultToast();
		quizRoute.retake();
	}

	function studyFlashcards(): void {
		quizRoute.studyFlashcards();
	}
</script>

<div
	class="mobile-quiz"
	onclick={handlePageClick}
	onkeydown={handlePageClick}
	role="button"
	tabindex="0"
	aria-label="Quiz content"
>
	{#if showResultToast && !quizRoute.showFinalResults}
		<div class="mobile-quiz__result-banner" transition:fly|global={{ y: 16, duration: 250 }}>
			<ResultIndicator
				show={showResultToast}
				isCorrect={quizRoute.lastAnswerCorrect}
				chosenAnswer={quizRoute.chosenAnswer}
				onComplete={handleResultTimerComplete}
				slideAxis="y"
				timerVisible={false}
			/>
		</div>
	{/if}

	<div class="mobile-quiz__content">
		{#if quizRoute.showFinalResults}
			<QuizResults
				score={quizRoute.finalScore}
				correct={quizRoute.finalCorrect}
				total={quizRoute.finalTotal}
				incorrect={quizRoute.finalIncorrect}
				variant="mobile"
			/>
		{:else if quizRoute.showAnswer && quizRoute.answer}
			<div class="mobile-quiz__answer">
				<DictionaryContent
					word={quizRoute.answer}
					backgroundColor="white"
					lists={quizRoute.lists}
				/>
			</div>
		{:else if quizRoute.currentQuestion}
			<div class="mobile-quiz__question-view">
				<h1>
					{#if isCharacterQuestion}
						{quizRoute.currentQuestion.word_data.simplified}
						{#if quizRoute.currentQuestion.word_data.simplified !== quizRoute.currentQuestion.word_data.traditional}
							<span class="mobile-quiz__traditional"
								>{quizRoute.currentQuestion.word_data.traditional}</span
							>
						{/if}
					{:else}
						{quizRoute.currentQuestion.question}
					{/if}
				</h1>
				<div class="mobile-quiz__options">
					{#each quizRoute.currentQuestion.options as option (option)}
						<button class="mobile-quiz__option" onclick={() => answerQuestion(option)}>
							{option}
						</button>
					{/each}
				</div>
			</div>
		{:else}
			<div class="mobile-quiz__empty">
				<h1>{quizRoute.loading ? LOADING_STUDY_MESSAGE : EMPTY_QUIZ_MESSAGE}</h1>
			</div>
		{/if}
	</div>

	<div class="mobile-quiz__dock">
		{#if !quizRoute.showFinalResults}
			<div class="mobile-quiz__progress">
				<SyProgressLine
					completed={quizRoute.questionsCompleted}
					total={quizRoute.questionsTotal || 1}
					endColor="var(--sy-color--green-3)"
				/>
			</div>
		{/if}

		<div class="mobile-quiz__bar">
			<div class="mobile-quiz__exit-row">
				<SyButton
					style="ghost"
					size="large"
					center={true}
					onclick={exitQuiz}
					classes={['mobile-quiz__exit-button']}
				>
					<X size="18" />
					<span>Exit</span>
				</SyButton>
			</div>

			<div
				class="mobile-quiz__actions-row"
				class:mobile-quiz__actions-row--final={quizRoute.showFinalResults}
			>
				{#if quizRoute.showFinalResults}
					{#each finalActions as action (action.label)}
						<div
							class="mobile-quiz__bar-cell"
							class:mobile-quiz__bar-cell--left={action.align === 'left'}
							class:mobile-quiz__bar-cell--right={action.align === 'right'}
						>
							<SyButton
								style="ghost"
								size="large"
								center={true}
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
						</div>
					{/each}
				{:else}
					<div class="mobile-quiz__bar-cell mobile-quiz__bar-cell--left">
						{#if quizRoute.showResult}
							<MobileTimer
								bind:this={timerRef}
								duration={QUIZ_RESULT_DISPLAY_TIME}
								autoStart={true}
								size={TIMER_SIZE}
								oncomplete={handleResultTimerComplete}
							/>
						{:else if quizRoute.showQuestionTimer}
							<MobileTimer
								bind:this={timerRef}
								duration={quizRoute.questionDuration}
								autoStart={true}
								size={TIMER_SIZE}
								oncomplete={handleQuestionTimerComplete}
								progressColor="var(--sy-color--red)"
							/>
						{/if}
					</div>

					<div class="mobile-quiz__bar-cell mobile-quiz__bar-cell--right">
						{#if quizRoute.showContinue}
							<SyButton
								style="ghost"
								size="large"
								center={true}
								onclick={continueAction.action}
								classes={continueAction.classes}
							>
								{#if continueAction.iconAfter}
									<span>{continueAction.label}</span>
									<continueAction.icon size="20" />
								{:else}
									<continueAction.icon size="20" />
									<span>{continueAction.label}</span>
								{/if}
							</SyButton>
						{/if}
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>

<style>
	.mobile-quiz {
		position: relative;
		display: flex;
		flex-direction: column;
		height: 100%;
		overflow: hidden;
		background-color: var(--sy-color--white);
	}

	.mobile-quiz:focus {
		outline: none;
	}

	.mobile-quiz__result-banner {
		position: absolute;
		bottom: calc(136px + env(safe-area-inset-bottom));
		left: calc(var(--sy-mobile-space--small) * 3);
		right: calc(var(--sy-mobile-space--small) * 3);
		display: flex;
		justify-content: center;
		padding: calc(var(--sy-mobile-space--extra-small) * 5)
			calc(var(--sy-mobile-space--small) * 3);
		background-color: var(--sy-color--white);
		border-radius: var(--sy-border-radius);
		border: var(--sy-mobile-surface-border);
		box-shadow: var(--sy-mobile-overlay-shadow);
		z-index: var(--sy-z-index--top-1);
		box-sizing: border-box;
	}

	.mobile-quiz__content {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		overflow-x: hidden;
		-webkit-overflow-scrolling: touch;
		padding-bottom: calc(142px + env(safe-area-inset-bottom));
		box-sizing: border-box;
	}

	.mobile-quiz__question-view {
		min-height: 100%;
		display: flex;
		flex-direction: column;
		align-items: stretch;
		padding: var(--sy-mobile-space--extra-large) calc(var(--sy-mobile-space--extra-small) * 9)
			calc(var(--sy-mobile-space--medium) * 3);
		box-sizing: border-box;
	}

	.mobile-quiz__question-view h1 {
		margin: 0 0 calc(var(--sy-mobile-space--small) * 7);
		text-align: center;
		font-size: var(--sy-font-size--display-medium);
		font-weight: 200;
		line-height: 1.3;
		overflow-wrap: anywhere;
	}

	.mobile-quiz__traditional {
		display: block;
		margin-top: calc(var(--sy-mobile-space--extra-small) * 5);
		font-size: var(--sy-font-size--display-medium);
		color: var(--sy-color--grey-5);
	}

	.mobile-quiz__options {
		display: flex;
		flex-direction: column;
		gap: calc(var(--sy-mobile-space--extra-small) * 7);
		width: 100%;
	}

	.mobile-quiz__option {
		width: 100%;
		min-height: var(--sy-mobile-quiz-option-min-height);
		padding: calc(var(--sy-mobile-space--extra-small) * 7) var(--sy-mobile-space--large);
		border: none;
		border-radius: var(--sy-border-radius);
		background-color: var(--sy-color--blue);
		box-shadow: var(--sy-shadow);
		color: var(--sy-color--white);
		font-family: var(--sy-font-family);
		font-size: var(--sy-font-size--mobile-extra-large);
		line-height: 1.25;
		overflow-wrap: anywhere;
	}

	.mobile-quiz__option:active {
		background-color: rgba(118, 175, 249, 0.65);
		box-shadow: var(--sy-shadow--active);
	}

	.mobile-quiz__answer {
		min-height: 100%;
		background-color: var(--sy-color--white);
	}

	.mobile-quiz__answer :global(.dictionary-content-container) {
		min-height: 100%;
		background-color: var(--sy-color--white);
	}

	.mobile-quiz__empty {
		min-height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: calc(var(--sy-mobile-space--medium) * 3);
		text-align: center;
		box-sizing: border-box;
	}

	.mobile-quiz__empty h1 {
		font-size: var(--sy-font-size--display-small);
		font-weight: 200;
		color: var(--sy-color--grey-5);
	}

	.mobile-quiz__dock {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: var(--sy-z-index--base-2);
	}

	.mobile-quiz__progress {
		background-color: var(--sy-color--white);
	}

	.mobile-quiz__bar {
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
	}

	.mobile-quiz__exit-row {
		display: flex;
		justify-content: center;
		min-height: var(--sy-mobile-bar-exit-row-height);
		border-bottom: var(--sy-border);
	}

	.mobile-quiz__actions-row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		align-items: center;
		gap: var(--sy-mobile-space--medium);
		min-height: var(--sy-mobile-bar-actions-row-height);
	}

	.mobile-quiz__actions-row--final {
		justify-content: space-between;
	}

	.mobile-quiz__bar-cell {
		display: flex;
		align-items: center;
		min-width: 0;
	}

	.mobile-quiz__bar-cell--left {
		justify-content: flex-start;
	}

	.mobile-quiz__bar-cell--right {
		justify-content: flex-end;
	}

	:global(.mobile-quiz__exit-button) {
		gap: calc(var(--sy-mobile-space--extra-small) * 3);
		width: 100%;
		margin: 0;
		color: var(--sy-color--grey-5);
	}

	:global(.mobile-quiz__bar-button) {
		gap: calc(var(--sy-mobile-space--extra-small) * 3);
		margin: 0;
		color: var(--sy-color--grey-6);
		white-space: nowrap;
	}

	:global(.mobile-quiz__continue-button) {
		gap: calc(var(--sy-mobile-space--extra-small) * 3);
		margin: 0;
		color: var(--sy-color--blue);
		white-space: nowrap;
	}
</style>
