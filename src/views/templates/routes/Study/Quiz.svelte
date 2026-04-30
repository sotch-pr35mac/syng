<script>
	import { ChevronLeft, ArrowRight, SquareStack, RotateCw } from 'lucide-svelte';
	import { onMount } from 'svelte';
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import DictionaryContent from '@/components/DictionaryContent/DictionaryContent.svelte';
	import { router } from 'svelte-spa-router';
	import ResultIndicator from '@/components/ResultIndicator/ResultIndicator.svelte';
	import SyTimer from '@/components/SyTimer/SyTimer.svelte';
	import SyProgressLine from '@/components/SyProgressLine/SyProgressLine.svelte';
	import QuizResults from '@/components/QuizResults/QuizResults.svelte';
	import { platform } from '@tauri-apps/plugin-os';
	import { EMPTY_QUIZ_MESSAGE, LOADING_STUDY_MESSAGE } from '@/composables/study.js';
	import { quizRoute } from '@/composables/quiz.svelte.js';

	const isMacos = platform() === 'macos';
	let timerRef = $state(); // Reference to the timer component
	const params = new URLSearchParams(router.querystring);
	const activeList = params.get('list');

	const handleRetakeQuiz = () => {
		quizRoute.retake();
	};
	const handleStudyFlashcards = () => {
		quizRoute.studyFlashcards();
	};
	const handleQuestionTimerComplete = () => {
		answerQuestion('N/A');
	};
	const answerQuestion = (answer) => {
		quizRoute.answerQuestion(answer);
	};
	const leftActions = [
		{
			icon: ChevronLeft,
			label: 'Exit',
			disabled: false,
			action: quizRoute.exit,
		},
	];
	// Derive rightActions based on quiz state
	const rightActions = $derived.by(() => {
		if (quizRoute.showFinalResults) {
			// Show results page actions
			return [
				{
					icon: RotateCw,
					label: 'Retake',
					disabled: false,
					action: handleRetakeQuiz,
				},
				{
					icon: SquareStack,
					label: 'Flashcards',
					disabled: false,
					action: handleStudyFlashcards,
				},
			];
		} else if (quizRoute.showAnswer) {
			// Show continue/finish button during quiz
			return [
				{
					icon: ArrowRight,
					label: quizRoute.continueLabel,
					disabled: false,
					action: () => {
						quizRoute.continue();
					},
				},
			];
		} else {
			// No actions during question display
			return [];
		}
	});

	onMount(() => {
		quizRoute.start(activeList);
	});

	const handleResultTimerComplete = () => {
		quizRoute.showResult = false;
		if (quizRoute.showAnswer) {
			// Move to next question
			rightActions[0]?.action();
		}
	};

	// Update the handlePageClick function
	function handlePageClick(event) {
		// Stop if the click was on the timer itself
		if (event.target.closest('.timer')) {
			return;
		}

		if (quizRoute.showResult) {
			timerRef?.pause();
		}
	}
</script>

<div class="quiz--container">
	<div class="quiz--header" data-tauri-drag-region={isMacos ? true : undefined}>
		<div class="quiz--header--section">
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
		<div class="quiz--header--section">
			{#if !quizRoute.showFinalResults}
				{#if quizRoute.showResult}
					<ResultIndicator
						show={quizRoute.showResult}
						isCorrect={quizRoute.lastAnswerCorrect}
						chosenAnswer={quizRoute.chosenAnswer}
						onComplete={handleResultTimerComplete}
						bind:timer={timerRef}
					/>
				{:else if quizRoute.showQuestionTimer}
					<div class="question-timer--container">
						<!-- eslint-disable no-magic-numbers -->
						<SyTimer
							duration={quizRoute.questionDuration}
							autoStart={true}
							size={32}
							oncomplete={handleQuestionTimerComplete}
							progressColor="var(--sy-color--red)"
						/>
						<!-- eslint-enable no-magic-numbers -->
					</div>
				{/if}
			{/if}
			{#each rightActions as action (action.label)}
				{#if action}
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
				{/if}
			{/each}
		</div>
	</div>
	<div
		class="quiz--content"
		onclick={handlePageClick}
		onkeydown={handlePageClick}
		role="button"
		tabindex="0"
		aria-label="Click to pause timer"
	>
		{#if quizRoute.showFinalResults}
			<QuizResults
				score={quizRoute.finalScore}
				correct={quizRoute.finalCorrect}
				total={quizRoute.finalTotal}
				incorrect={quizRoute.finalIncorrect}
			/>
		{:else}
			<!-- Quiz Questions/Answers -->
			{#if quizRoute.showAnswer}
				<div class="quiz--answer">
					<DictionaryContent
						word={quizRoute.answer}
						backgroundColor="white"
						lists={quizRoute.lists}
					/>
				</div>
			{:else}
				<div class="quiz--questions">
					{#if quizRoute.question !== undefined}
						<span class="quiz--question">
							{quizRoute.question.question.MultipleChoice.question}
						</span>
						<div class="quiz--options">
							{#each quizRoute.question.question.MultipleChoice.options as option (option)}
								<button class="quiz--option" onclick={() => answerQuestion(option)}>
									{option}
								</button>
							{/each}
						</div>
					{:else}
						<div class="title-message--container">
							<h1 class="title-message">
								{quizRoute.loading ? LOADING_STUDY_MESSAGE : EMPTY_QUIZ_MESSAGE}
							</h1>
						</div>
					{/if}
				</div>
			{/if}
			<SyProgressLine
				completed={quizRoute.questionsCompleted}
				total={quizRoute.questionsTotal}
				endColor="var(--sy-color--green-3)"
			/>
		{/if}
	</div>
</div>

<style>
	.quiz--container {
		display: flex;
		flex-direction: column;
		height: 100vh;
		width: 100%;
	}
	.quiz--header {
		display: flex;
		padding: var(--sy-space--extra-large) var(--sy-space--large);
		margin: 0;
		background-color: var(--sy-color--white);
		box-shadow: var(--sy-box-shadow);
		z-index: var(--sy-z-index--base-2);
		align-items: center;
		justify-content: space-between;
	}
	.quiz--header--section {
		display: flex;
		align-items: center;
		justify-content: space-around;
	}
	.quiz--content {
		display: flex;
		background-color: var(--sy-color--white);
		width: 100%;
		height: 100%;
		overflow-y: auto;
		overflow-x: hidden;
		z-index: var(--sy-z-index--base-1);
		flex-direction: column;
		align-items: space-between;
	}
	.quiz--answer {
		display: flex;
		margin: var(--sy-space--large) var(--sy-space--extra-large);
		flex: 1;
	}
	.quiz--questions {
		display: flex;
		align-items: center;
		flex-direction: column;
		padding: var(--sy-space--extra-large);
		flex: 1;
	}
	.quiz--question {
		margin: calc(var(--sy-space--extra-large) * 2);
		font-size: var(--sy-font-size--display-large);
		font-weight: 200;
	}
	.quiz--options {
		margin: calc(var(--sy-space--extra-large) * 2);
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--sy-space--large);
		width: 100%;
	}
	.quiz--option {
		margin: var(--sy-space--extra-large) var(--sy-space--large);
		padding: calc(var(--sy-space--extra-large) - var(--sy-space));
		border: none;
		cursor: pointer;
		box-shadow: var(--sy-shadow);
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--sy-color--white);
		background-color: var(--sy-color--blue);
		border-radius: var(--sy-border-radius);
		font-size: var(--sy-font-size--display-medium);
	}
	.quiz--option:hover {
		box-shadow: var(--sy-shadow--active);
		background-color: rgba(118, 175, 249, 0.65);
		transition-property: background-color, box-shadow;
		transition-duration: var(--sy-transition-duration);
	}
	.title-message--container {
		display: flex;
		justify-content: center;
		width: 100%;
		height: 100%;
		margin-bottom: 83px;
	}
	.title-message {
		font-size: var(--sy-font-size--display-large);
		font-weight: 200;
	}
	.question-timer--container {
		margin: 0 var(--sy-space--large);
	}
</style>
