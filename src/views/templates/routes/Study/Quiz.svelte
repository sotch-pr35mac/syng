<script>
	import { ChevronLeftIcon, ArrowRightIcon } from "svelte-feather-icons";
	import SyButton from "../../components/SyButton/SyButton.svelte";
	import DictionaryContent from "../../components/DictionaryContent/DictionaryContent.svelte";
	import { querystring } from "svelte-spa-router";
	import { handleError } from "../../utils";
	import ResultIndicator from "../../components/ResultIndicator/ResultIndicator.svelte";
	import SyTimer from "../../components/SyTimer/SyTimer.svelte";
	import SyProgressLine from "../../components/SyProgressLine/SyProgressLine.svelte";

	// TODO: Consider moving these into a utility file or something...
	// Quiz Constants
	const PINYIN_QUESTIONS = "Pinyin";
	const ENGLISH_QUESTIONS = "English";
	const CHARACTER_QUESTIONS = "Characters";
	const SIMPLE_QUIZ = "Simple";

	const EMPTY_MESSAGE = "No Questions Available";
	const LOADING_MESSAGE = "Loading...";
	const isMacos = window.platform === "darwin";
	let loading = true;

	let activeList = undefined;
	let question = undefined;
	let showAnswer = false;
	let answer = undefined;
	let questionStartTime = undefined;
	let questionsTotal = 0;
	let questionsCompleted = 0;
	let questionsPending = 0;
	let finalIncorrect = [];
	let finalScore = undefined;
	let finalCorrect = undefined;
	let finalTotal = undefined;
	let questionDuration = 10; // Default to 10 seconds, but ultimately determined by the quiz config
	let lists = [];
	let params = new URLSearchParams($querystring);
	activeList = params.get("list");

	// Initialize the lists value
	window.bookmarkManager
		.getLists()
		.then((wl) => {
			lists = wl;
		})
		.catch((e) => {
			handleError(
				"There was an error fetching word lists. Check the log for more details.",
				e,
			);
		});
	const handleFinishQuiz = () => {
		console.log("finalScore", finalScore);
		console.log("finalCorrect", finalCorrect);
		console.log("finalTotal", finalTotal);
		console.log("finalIncorrect", finalIncorrect);
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
		answerQuestion("N/A");
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
		forcePause = false;
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
		window.__TAURI__
			.invoke("answer_question", {
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
					"There was an error answering the question. Check the log for more details.",
					e,
				);
			});
	};
	const handleListChange = () => {
		if (activeList) {
			window.bookmarkManager
				.getListContent(activeList)
				.then((contents) => {
					return window.__TAURI__.invoke("start_quiz", {
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
					return window.__TAURI__.invoke("get_next_question");
				})
				.then((quizQuestion) => {
					handleQuestionChange(quizQuestion);
				})
				.catch((e) => {
					handleError(
						"There was an error starting the quiz. Check the log for more details.",
						e,
					);
				});
		}
	};
	const leftActions = [
		{
			icon: ChevronLeftIcon,
			label: "Exit",
			disabled: false,
			action: () => {
				window.history.back();
			},
		},
	];
	const rightActions = [];
	$: rightActions[0] = showAnswer
		? {
				icon: ArrowRightIcon,
				label: questionsPending > 1 ? "Continue" : "Finish",
				disabled: false,
				action: () => {
					showResult = questionsPending > 1 ? false : true;
					forcePause = false;
					if (questionsPending > 1) {
						window.__TAURI__
							.invoke("get_next_question")
							.then((quizQuestion) => {
								handleQuestionChange(quizQuestion);
							})
							.catch((e) => {
								handleError(
									"There was an error getting the next question.",
									e,
								);
							});
					} else {
						window.__TAURI__
							.invoke("score_quiz")
							.then((score) => {
								handleScoreChange(score);
								return window.__TAURI__.invoke(
									"get_incorrect_questions",
								);
							})
							.then((incorrect) => {
								handleIncorrectChange(incorrect);
								handleFinishQuiz();
							})
							.catch((e) => {
								handleError(
									"There was an error getting the next question.",
									e,
								);
							});
					}
				},
			}
		: undefined;

	// Call `handleListChange` whenever `activeList` changes.
	$: handleListChange();

	let forcePause = false;
	let showResult = false;
	let lastAnswerCorrect = false;
	let chosenAnswer = "";

	let timerRef; // Reference to the timer component

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
		if (event.target.closest(".timer")) {
			return;
		}

		if (showResult) {
			timerRef?.pause();
		}
	}
</script>

<div class="quiz--container">
	<div
		class="quiz--header"
		data-tauri-drag-region={isMacos ? true : undefined}
	>
		<div class="quiz--header--section">
			{#each leftActions as action}
				<SyButton
					disabled={action.disabled}
					on:click={action.action}
					style="ghost"
					center={true}
				>
					<svelte:component this={action.icon} />
					&nbsp;
					{action.label}
				</SyButton>
			{/each}
		</div>
		<div class="quiz--header--section">
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
						progressColor={"var(--sy-color--red)"}
					/>
				</div>
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
						<svelte:component this={action.icon} />
					</SyButton>
				{/if}
			{/each}
		</div>
	</div>
	<div
		class="quiz--content"
		on:click={handlePageClick}
		on:keydown={handlePageClick}
	>
		{#if showAnswer}
			<div class="quiz--answer">
				<DictionaryContent
					word={answer}
					backgroundColor="white"
					{lists}
				/>
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
								on:click={() => answerQuestion(option)}
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
		font-size: 10vh;
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
		font-size: 5vh;
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
		font-size: 10vh;
		font-weight: 200;
	}
	.question-timer--container {
		margin: 0 var(--sy-space--large);
	}
</style>
