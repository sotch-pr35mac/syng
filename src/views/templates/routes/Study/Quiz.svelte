<script>
	import { ChevronLeft, ArrowRight, SquareStack, RotateCw } from 'lucide-svelte';
	import { onMount } from 'svelte';
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import DictionaryContent from '@/components/DictionaryContent/DictionaryContent.svelte';
	import DictionaryPopover from '@/components/DictionaryPopover/DictionaryPopover.svelte';
	import { router } from 'svelte-spa-router';
	import ResultIndicator from '@/components/ResultIndicator/ResultIndicator.svelte';
	import SyTimer from '@/components/SyTimer/SyTimer.svelte';
	import SyProgressLine from '@/components/SyProgressLine/SyProgressLine.svelte';
	import QuizResults from '@/components/QuizResults/QuizResults.svelte';
	import QuizDisplayText from '@/components/QuizText/QuizDisplayText.svelte';
	import { platform } from '@tauri-apps/plugin-os';
	import { CHARACTER_QUESTIONS, LOADING_STUDY_MESSAGE } from '@/composables/study.js';
	import { quizRoute } from '@/composables/quiz.svelte.js';
	import { isIPad } from '@/utils/device.js';
	import { responsiveLayout } from '@/actions/responsiveLayout.js';

	const isMacos = platform() === 'macos';
	const isIPadDevice = isIPad();
	let timerRef = $state(); // Reference to the timer component
	const params = new URLSearchParams(router.querystring);
	const activeList = params.get('list');

	// Reset scroll to top when the question or the question/answer view changes, so a
	// scrolled-down previous word doesn't leave the next word/answer out of view.
	let contentElement = $state();
	$effect(() => {
		void quizRoute.question;
		void quizRoute.showAnswer;
		if (contentElement) {
			contentElement.scrollTop = 0;
		}
	});

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
		quizRoute.start(activeList, params.get('from'));
		return quizRoute.endSession;
	});

	const handleResultTimerComplete = () => {
		quizRoute.showResult = false;
		if (quizRoute.showAnswer) {
			// Move to next question
			rightActions[0]?.action();
		}
	};

	function handlePageClick(event) {
		// Native keyboard activation belongs to its button, not the pointer pause shortcut.
		if (event.detail === 0) {
			return;
		}
		// Stop if the click was on the timer itself
		if (event.target.closest('.timer')) {
			return;
		}

		if (quizRoute.showResult) {
			timerRef?.pause();
		}
	}
</script>

<div
	class="quiz--container"
	use:responsiveLayout={{ thresholdRem: 36, className: 'quiz--compact' }}
>
	<p class="sy-sr-only" role="status" aria-atomic="true">
		{#if quizRoute.showFinalResults}
			Quiz complete. {quizRoute.finalCorrect} of {quizRoute.finalTotal} correct.
		{:else if quizRoute.showResult}
			{quizRoute.lastAnswerCorrect ? 'Correct answer.' : 'Incorrect answer.'}
		{:else if quizRoute.currentQuestion}
			Question {quizRoute.questionsCompleted + 1} of {quizRoute.questionsTotal}.
		{/if}
	</p>

	<div
		class="quiz--header"
		class:quiz--header--ipad={isIPadDevice}
		data-tauri-drag-region={isMacos ? true : undefined}
	>
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
						<!-- eslint-disable @typescript-eslint/no-magic-numbers -->
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
	<!-- Pointer pause shortcut; the timer button provides the keyboard action. -->
	<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
	<div
		class="quiz--content"
		bind:this={contentElement}
		onclick={handlePageClick}
		role="region"
		aria-label="Quiz content"
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
						onlink={quizRoute.lookupPopoverWord}
					/>
				</div>
			{:else}
				<div class="quiz--questions">
					{#if quizRoute.question !== undefined}
						{@const currentQuestion = quizRoute.question.question.MultipleChoice}
						<span class="quiz--question">
							<QuizDisplayText
								text={currentQuestion.question}
								characters={currentQuestion.kind === CHARACTER_QUESTIONS
									? currentQuestion.lexical_unit
									: undefined}
								variant="display"
								lexicalTestIdPrefix="quiz-question"
							/>
						</span>
						<div class="quiz--options">
							{#each currentQuestion.options as option (option.value)}
								<button
									type="button"
									class="quiz--option"
									onclick={() => answerQuestion(option.value)}
								>
									<QuizDisplayText
										text={option.value}
										characters={option.characters}
										variant="inline"
									/>
								</button>
							{/each}
						</div>
					{:else}
						<div class="title-message--container">
							<h1 class="title-message">
								{quizRoute.loading
									? LOADING_STUDY_MESSAGE
									: quizRoute.unavailableMessage}
							</h1>
							{#if quizRoute.canStudyFlashcards}<SyButton
									onclick={quizRoute.studyFlashcards}>Flashcards</SyButton
								>{/if}
							{#if quizRoute.error}<SyButton onclick={quizRoute.retake}
									>Try again</SyButton
								>{/if}
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

<DictionaryPopover
	word={quizRoute.popoverWord}
	results={quizRoute.popoverResults}
	resultIndex={quizRoute.popoverResultIndex}
	lists={quizRoute.lists}
	anchor={quizRoute.popoverAnchor}
	reopenKey={quizRoute.popoverReopenKey}
	onselect={quizRoute.selectPopoverResult}
	onlink={quizRoute.lookupPopoverWord}
	onclose={quizRoute.closePopoverDictionary}
/>

<style>
	.quiz--container {
		display: flex;
		flex-direction: column;
		height: 100vh;
		width: 100%;
	}
	.quiz--header {
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
	.quiz--header--ipad {
		padding-top: max(var(--sy-space--large), env(safe-area-inset-top, 0px));
		padding-bottom: var(--sy-space--large);
	}
	.quiz--header--section {
		flex-wrap: wrap;
		display: flex;
		align-items: center;
		justify-content: space-around;
	}
	.quiz--content {
		min-height: 0;
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
	:global(.quiz--compact) .quiz--options {
		grid-template-columns: minmax(0, 1fr);
	}
	.quiz--options {
		margin: calc(var(--sy-space--extra-large) * 2);
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
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
		color: var(--sy-text--on-fill);
		background-color: var(--sy-fill--blue);
		border-radius: var(--sy-border-radius);
		font-size: var(--sy-font-size--display-medium);
	}
	.quiz--option:hover {
		box-shadow: var(--sy-shadow--active);
		background-color: var(--sy-fill--blue);
		transition-property: background-color, box-shadow;
		transition-duration: var(--sy-transition-duration);
	}
	.title-message--container {
		flex-direction: column;
		align-items: center;
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
