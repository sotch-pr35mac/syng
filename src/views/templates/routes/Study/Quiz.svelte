<script>
  import { run } from 'svelte/legacy';

import {
	ChevronLeftIcon,
	ArrowRightIcon,
	CopyIcon,
	RotateCwIcon,
} from 'svelte-feather-icons';
import SyButton from '../../components/SyButton/SyButton.svelte';
import DictionaryContent from '../../components/DictionaryContent/DictionaryContent.svelte';
import { querystring } from 'svelte-spa-router';
import { handleError } from '../../utils';
import ResultIndicator from '../../components/ResultIndicator/ResultIndicator.svelte';
import SyTimer from '../../components/SyTimer/SyTimer.svelte';
import SyProgressLine from '../../components/SyProgressLine/SyProgressLine.svelte';
import { invoke } from '@tauri-apps/api/core';

// TODO: Consider moving these into a utility file or something...
// Quiz Constants
const PINYIN_QUESTIONS = 'Pinyin';
const ENGLISH_QUESTIONS = 'English';
const CHARACTER_QUESTIONS = 'Characters';
const SIMPLE_QUIZ = 'Simple';

const EMPTY_MESSAGE = 'No Questions Available';
const LOADING_MESSAGE = 'Loading...';
const isMacos = window.platform === 'darwin';
let loading = $state(true);

let activeList = undefined;
let question = $state(undefined);
let showAnswer = $state(false);
let answer = $state(undefined);
let questionStartTime = undefined;
let questionsTotal = $state(0);
let questionsCompleted = $state(0);
let questionsPending = $state(0);
let finalIncorrect = $state([]);
let finalScore = $state(undefined);
let finalCorrect = $state(undefined);
let finalTotal = $state(undefined);
let questionDuration = $state(10); // Default to 10 seconds, but ultimately determined by the quiz config
let lists = $state([]);
let params = new URLSearchParams($querystring);
activeList = params.get('list');

// Initialize the lists value
window.bookmarkManager
	.getLists()
	.then((wl) => {
		lists = wl;
	})
	.catch((e) => {
		handleError(
			'There was an error fetching word lists. Check the log for more details.',
			e,
		);
	});
const handleRetakeQuiz = () => {
	// Reset the quiz state
	finalScore = undefined;
	finalCorrect = undefined;
	finalTotal = undefined;
	finalIncorrect = [];
	question = undefined;
	showAnswer = false;
	answer = undefined;
	questionsCompleted = 0;
	questionsPending = 0;
	questionsTotal = 0;
	showResult = false;
	loading = true;
	// Restart the quiz
	handleListChange();
};
const handleStudyFlashcards = () => {
	window.location.hash = `#/study/flashcards?list=${activeList}`;
};
const handleScoreChange = (score) => {
	finalScore = score.score;
	finalCorrect = score.correct;
	finalTotal = score.total;
};
const handleIncorrectChange = (incorrect) => {
	finalIncorrect = incorrect;
};
const handleQuestionTimerComplete = () => {
	answerQuestion('N/A');
};
const handleQuestionChange = (quizQuestion) => {
	question = quizQuestion;
	questionDuration = quizQuestion.question.MultipleChoice.time_limit;
	questionsCompleted = quizQuestion.completed;
	questionsPending = quizQuestion.pending;
	questionsTotal = quizQuestion.completed + quizQuestion.pending;
	loading = false;
	showAnswer = false;
	showResult = false;
	questionStartTime = Date.now();
};
const handleAnswerChange = (answerResponse) => {
	answer = answerResponse.question.MultipleChoice.word_data;
	showAnswer = true;
	showResult = true;
	lastAnswerCorrect = answerResponse.correct;
};
const answerQuestion = (answer) => {
	chosenAnswer = answer;
	const answeredIn = Math.round((Date.now() - questionStartTime) / 1000);
	invoke('answer_question', {
		response: {
			response: answer,
			answered_in: answeredIn,
		},
	})
		.then((answerResponse) => {
			handleAnswerChange(answerResponse);
		})
		.catch((e) => {
			handleError(
				'There was an error answering the question. Check the log for more details.',
				e,
			);
		});
};
const handleListChange = () => {
	if (activeList) {
		window.bookmarkManager
			.getListContent(activeList)
			.then((contents) => {
				return invoke('start_quiz', {
					config: {
						words: contents,
						kind: SIMPLE_QUIZ,
						question_kinds: [
							PINYIN_QUESTIONS,
							ENGLISH_QUESTIONS,
							CHARACTER_QUESTIONS,
						],
					},
				});
			})
			.then(() => {
				return invoke('get_next_question');
			})
			.then((quizQuestion) => {
				handleQuestionChange(quizQuestion);
			})
			.catch((e) => {
				handleError(
					'There was an error starting the quiz. Check the log for more details.',
					e,
				);
			});
	}
};
const leftActions = [
	{
		icon: ChevronLeftIcon,
		label: 'Exit',
		disabled: false,
		action: () => {
			window.location.hash = '#/study';
		},
	},
];
let rightActions = $state([]);

// Reactive statement to update rightActions based on quiz state
run(() => {
	if (finalScore !== undefined) {
		// Show results page actions
		rightActions = [
			{
				icon: RotateCwIcon,
				label: 'Retake',
				disabled: false,
				action: handleRetakeQuiz,
			},
			{
				icon: CopyIcon,
				label: 'Flashcards',
				disabled: false,
				action: handleStudyFlashcards,
			},
		];
	} else if (showAnswer) {
		// Show continue/finish button during quiz
		rightActions = [
			{
				icon: ArrowRightIcon,
				label: questionsPending > 1 ? 'Continue' : 'Finish',
				disabled: false,
				action: () => {
					showResult = questionsPending > 1 ? false : true;
					if (questionsPending > 1) {
						invoke('get_next_question')
							.then((quizQuestion) => {
								handleQuestionChange(quizQuestion);
							})
							.catch((e) => {
								handleError('There was an error getting the next question.', e);
							});
					} else {
						invoke('score_quiz')
							.then((score) => {
								handleScoreChange(score);
								return invoke('get_incorrect_questions');
							})
							.then((incorrect) => {
								handleIncorrectChange(incorrect);
							})
							.catch((e) => {
								handleError('There was an error getting the next question.', e);
							});
					}
				},
			},
		];
	} else {
		// No actions during question display
		rightActions = [];
	}
});

// Call `handleListChange` whenever `activeList` changes.
run(() => {
    handleListChange();
  });

let showResult = $state(false);
let lastAnswerCorrect = $state(false);
let chosenAnswer = $state('');

let timerRef = $state(); // Reference to the timer component

const handleResultTimerComplete = () => {
	showResult = false;
	if (showAnswer) {
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

	if (showResult) {
		timerRef?.pause();
	}
}
</script>

<div class="quiz--container">
  <div class="quiz--header" data-tauri-drag-region={isMacos ? true : undefined}>
    <div class="quiz--header--section">
      {#each leftActions as action}
        <SyButton
          disabled={action.disabled}
          on:click={action.action}
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
      {#if finalScore === undefined}
        {#if showResult}
          <ResultIndicator
            show={showResult}
            isCorrect={lastAnswerCorrect}
            {chosenAnswer}
            onComplete={handleResultTimerComplete}
            bind:timer={timerRef}
          />
        {:else}
          <div class="question-timer--container">
            <SyTimer
              duration={questionDuration}
              autoStart={true}
              size={32}
              on:complete={handleQuestionTimerComplete}
              progressColor={'var(--sy-color--red)'}
            />
          </div>
        {/if}
      {/if}
      {#each rightActions as action}
        {#if action}
          <SyButton
            disabled={action.disabled}
            on:click={action.action}
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
  >
    {#if finalScore !== undefined}
      <!-- Results Page -->
      <div class="quiz--results">
        <div class="results--score-container">
          <div class="results--score">
            <span class="results--score-text">
              {finalScore}%
            </span>
            <span class="results--percentage">
              {finalCorrect}/{finalTotal}
            </span>
          </div>
          {#if finalCorrect === finalTotal}
            <p class="results--message results--message-perfect">
              Perfect score! Excellent work!
            </p>
          {:else if finalCorrect / finalTotal >= 0.8}
            <p class="results--message results--message-good">
              Great job! Keep it up!
            </p>
          {:else if finalCorrect / finalTotal >= 0.6}
            <p class="results--message results--message-okay">
              Good effort! A bit more practice will help.
            </p>
          {:else}
            <p class="results--message results--message-needs-work">
              Keep practicing - you'll get there!
            </p>
          {/if}
        </div>

        {#if finalIncorrect && finalIncorrect.length > 0}
          <div class="results--incorrect">
            <h2 class="results--incorrect-title">Incorrect Answers</h2>
            <div class="results--incorrect-list">
              {#each finalIncorrect as incorrect}
                <div class="results--incorrect-item">
                  <div class="results--incorrect-question">
                    <strong>Question:</strong>
                    {incorrect.question.MultipleChoice.question}
                  </div>
                  <div class="results--incorrect-details">
                    <span class="results--incorrect-your-answer">
                      Your answer: <span class="incorrect-highlight"
                        >{incorrect.response}</span
                      >
                    </span>
                    <span class="results--incorrect-correct-answer">
                      Correct answer: <span class="correct-highlight"
                        >{incorrect.question.MultipleChoice.answer}</span
                      >
                    </span>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    {:else}
      <!-- Quiz Questions/Answers -->
      {#if showAnswer}
        <div class="quiz--answer">
          <DictionaryContent word={answer} backgroundColor="white" {lists} />
        </div>
      {:else}
        <div class="quiz--questions">
          {#if question != undefined}
            <span class="quiz--question">
              {question.question.MultipleChoice.question}
            </span>
            <div class="quiz--options">
              {#each question.question.MultipleChoice.options as option}
                <button
                  class="quiz--option"
                  onclick={() => answerQuestion(option)}
                >
                  {option}
                </button>
              {/each}
            </div>
          {:else}
            <div class="title-message--container">
              <h1 class="title-message">
                {loading ? LOADING_MESSAGE : EMPTY_MESSAGE}
              </h1>
            </div>
          {/if}
        </div>
      {/if}
      <SyProgressLine
        completed={questionsCompleted}
        total={questionsTotal}
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

/* Results Page Styles */
.quiz--results {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  padding: calc(var(--sy-space--extra-large) * 2);
  flex: 1;
  overflow-y: auto;
  width: 100%;
  box-sizing: border-box;
}
.results--score-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
}
.results--score {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.results--score-text {
  font-size: var(--sy-font-size--display-extra-large);
  font-weight: 200;
  color: var(--sy-color--blue);
  line-height: 1;
  margin-bottom: var(--sy-space--large);
}
.results--percentage {
  font-size: var(--sy-font-size--display-medium);
  font-weight: 200;
  color: var(--sy-color--text-secondary);
  margin-top: var(--sy-space);
}
.results--message {
  font-size: var(--sy-font-size--display-small);
  font-weight: 300;
  text-align: center;
}
.results--message-perfect {
  color: var(--sy-color--green-3);
}
.results--message-good {
  color: var(--sy-color--blue);
}
.results--message-okay {
  color: var(--sy-color--orange);
}
.results--message-needs-work {
  color: var(--sy-color--text-secondary);
}
.results--incorrect {
  width: 100%;
  max-width: 800px;
  margin: 0 auto;
}
.results--incorrect-title {
  font-size: var(--sy-font-size--display-medium);
  font-weight: 300;
  margin-bottom: var(--sy-space--large);
  text-align: center;
  color: var(--sy-color--text);
}
.results--incorrect-list {
  display: flex;
  flex-direction: column;
  gap: var(--sy-space--large);
}
.results--incorrect-item {
  background-color: var(--sy-color--white);
  border-radius: var(--sy-border-radius);
  padding: var(--sy-space--large);
  box-shadow: var(--sy-shadow);
  border-left: 4px solid var(--sy-color--red);
}
.results--incorrect-question {
  font-size: var(--sy-font-size--display-small);
  margin-bottom: var(--sy-space);
  color: var(--sy-color--text);
}
.results--incorrect-details {
  display: flex;
  flex-direction: column;
  gap: var(--sy-space);
  font-size: var(--sy-font-size--display-extra-small);
  color: var(--sy-color--text-secondary);
}
.incorrect-highlight {
  color: var(--sy-color--red);
  font-weight: 600;
}
.correct-highlight {
  color: var(--sy-color--green-3);
  font-weight: 600;
}
</style>
