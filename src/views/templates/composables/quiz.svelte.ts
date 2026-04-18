import { invoke } from '@tauri-apps/api/core';
import { bookmarksStore, type BookmarkWordEntry } from '../stores/bookmarks.svelte.js';
import { studySubRouteStore } from '../stores/studyRoute.svelte.js';
import { NATIVE_COMMANDS } from '../types/nativeCommands.js';
import { handleError, telemetry } from '../utils/index.js';
import {
	CHARACTER_QUESTIONS,
	DEFAULT_QUESTION_DURATION,
	ENGLISH_QUESTIONS,
	MINIMUM_QUIZ_WORD_COUNT,
	PINYIN_QUESTIONS,
	SIMPLE_QUIZ,
	type AnswerResponse,
	type IncorrectAnswer,
	type QuizQuestion,
	type ScoreCard,
} from './study.js';

let quizActiveList = $state<string | null>(null);
let quizQuestion = $state<QuizQuestion | undefined>(undefined);
let quizShowAnswer = $state(false);
let quizAnswer = $state<BookmarkWordEntry | undefined>(undefined);
let quizQuestionStartTime = 0;
let quizQuestionsTotal = $state(0);
let quizQuestionsCompleted = $state(0);
let quizQuestionsPending = $state(0);
let quizFinalIncorrect = $state<IncorrectAnswer[]>([]);
let quizFinalScore = $state<number | undefined>(undefined);
let quizFinalCorrect = $state<number | undefined>(undefined);
let quizFinalTotal = $state<number | undefined>(undefined);
let quizQuestionDuration = $state(DEFAULT_QUESTION_DURATION);
let quizShowResult = $state(false);
let quizLastAnswerCorrect = $state(false);
let quizChosenAnswer = $state('');
let quizLoading = $state(true);
const EMPTY_QUIZ_ERROR = new Error('EMPTY_QUIZ');

function resetQuizState(): void {
	quizFinalScore = undefined;
	quizFinalCorrect = undefined;
	quizFinalTotal = undefined;
	quizFinalIncorrect = [];
	quizQuestion = undefined;
	quizShowAnswer = false;
	quizAnswer = undefined;
	quizQuestionsCompleted = 0;
	quizQuestionsPending = 0;
	quizQuestionsTotal = 0;
	quizShowResult = false;
	quizChosenAnswer = '';
	quizLoading = true;
}

function handleQuestionChange(quizQuestionResponse: QuizQuestion): void {
	quizQuestion = quizQuestionResponse;
	quizQuestionDuration = quizQuestionResponse.question.MultipleChoice.time_limit;
	quizQuestionsCompleted = quizQuestionResponse.completed;
	quizQuestionsPending = quizQuestionResponse.pending;
	quizQuestionsTotal = quizQuestionResponse.completed + quizQuestionResponse.pending;
	quizLoading = false;
	quizShowAnswer = false;
	quizShowResult = false;
	quizQuestionStartTime = Date.now();
}

function startQuiz(activeList: string | null): void {
	quizActiveList = activeList;
	resetQuizState();
	studySubRouteStore.set('quiz');

	if (!quizActiveList) {
		quizLoading = false;
		return;
	}

	bookmarksStore
		.getContent(quizActiveList)
		.then((contents) => {
			if (contents.length < MINIMUM_QUIZ_WORD_COUNT) {
				quizLoading = false;
				return Promise.reject(EMPTY_QUIZ_ERROR);
			}

			return invoke(NATIVE_COMMANDS.QUIZ.START, {
				config: {
					words: contents,
					kind: SIMPLE_QUIZ,
					question_kinds: [PINYIN_QUESTIONS, ENGLISH_QUESTIONS, CHARACTER_QUESTIONS],
				},
			}).then((result) => {
				telemetry
					.trackEvent('quiz.started', { word_count: contents.length })
					.catch(() => {});
				return result;
			});
		})
		.then(() => invoke<QuizQuestion>(NATIVE_COMMANDS.QUIZ.NEXT_QUESTION))
		.then((nextQuestion) => {
			handleQuestionChange(nextQuestion);
			return undefined;
		})
		.catch((error) => {
			if (error === EMPTY_QUIZ_ERROR) {
				return;
			}

			quizLoading = false;
			handleError(
				'There was an error starting the quiz. Check the log for more details.',
				error
			);
		});
}

function answerQuestion(response: string): Promise<boolean> {
	if (!quizQuestion || quizShowAnswer || quizFinalScore !== undefined) {
		return Promise.resolve(false);
	}

	quizChosenAnswer = response;
	const answeredIn = Math.round((Date.now() - quizQuestionStartTime) / 1000);
	return invoke<AnswerResponse>(NATIVE_COMMANDS.QUIZ.ANSWER, {
		response: {
			response,
			answered_in: answeredIn,
		},
	})
		.then((answerResponse) => {
			quizAnswer = answerResponse.question.MultipleChoice.word_data;
			quizShowAnswer = true;
			quizShowResult = true;
			quizLastAnswerCorrect = answerResponse.correct;
			return true;
		})
		.catch((error) => {
			handleError(
				'There was an error answering the question. Check the log for more details.',
				error
			);
			return false;
		});
}

function continueQuiz(): void {
	quizShowResult = quizQuestionsPending > 1 ? false : true;
	if (quizQuestionsPending > 1) {
		invoke<QuizQuestion>(NATIVE_COMMANDS.QUIZ.NEXT_QUESTION)
			.then((nextQuestion) => {
				handleQuestionChange(nextQuestion);
				return undefined;
			})
			.catch((error) => {
				handleError('There was an error getting the next question.', error);
			});
		return;
	}

	invoke<ScoreCard>(NATIVE_COMMANDS.QUIZ.SCORE)
		.then((score) => {
			quizFinalScore = score.score;
			quizFinalCorrect = score.correct;
			quizFinalTotal = score.total;
			telemetry.trackEvent('quiz.completed', {}).catch(() => {});
			return invoke<IncorrectAnswer[]>(NATIVE_COMMANDS.QUIZ.INCORRECT);
		})
		.then((incorrect) => {
			quizFinalIncorrect = incorrect;
			return undefined;
		})
		.catch((error) => {
			handleError('There was an error getting the next question.', error);
		});
}

function retakeQuiz(): void {
	startQuiz(quizActiveList);
}

function exitQuiz(): void {
	studySubRouteStore.set(null);
	window.location.hash = '#/study';
}

function studyFlashcardsFromQuiz(): void {
	if (quizActiveList) {
		window.location.hash = `#/study/flashcards?list=${encodeURIComponent(quizActiveList)}`;
	}
}

export const quizRoute = {
	get activeList(): string | null {
		return quizActiveList;
	},
	get question(): QuizQuestion | undefined {
		return quizQuestion;
	},
	get currentQuestion() {
		return quizQuestion?.question.MultipleChoice;
	},
	get showAnswer(): boolean {
		return quizShowAnswer;
	},
	get answer(): BookmarkWordEntry | undefined {
		return quizAnswer;
	},
	get questionsTotal(): number {
		return quizQuestionsTotal;
	},
	get questionsCompleted(): number {
		return quizQuestionsCompleted;
	},
	get questionsPending(): number {
		return quizQuestionsPending;
	},
	get finalIncorrect(): IncorrectAnswer[] {
		return quizFinalIncorrect;
	},
	get finalScore(): number | undefined {
		return quizFinalScore;
	},
	get finalCorrect(): number | undefined {
		return quizFinalCorrect;
	},
	get finalTotal(): number | undefined {
		return quizFinalTotal;
	},
	get questionDuration(): number {
		return quizQuestionDuration;
	},
	get showResult(): boolean {
		return quizShowResult;
	},
	set showResult(value: boolean) {
		quizShowResult = value;
	},
	get lastAnswerCorrect(): boolean {
		return quizLastAnswerCorrect;
	},
	get chosenAnswer(): string {
		return quizChosenAnswer;
	},
	get loading(): boolean {
		return quizLoading;
	},
	get lists(): string[] {
		return bookmarksStore.lists;
	},
	get showFinalResults(): boolean {
		return quizFinalScore !== undefined;
	},
	get showQuestionTimer(): boolean {
		return quizQuestion !== undefined && !quizShowAnswer && quizFinalScore === undefined;
	},
	get showContinue(): boolean {
		return quizShowAnswer && quizFinalScore === undefined;
	},
	get continueLabel(): string {
		return quizQuestionsPending > 1 ? 'Continue' : 'Finish';
	},
	start: startQuiz,
	reset: resetQuizState,
	answerQuestion,
	continue: continueQuiz,
	retake: retakeQuiz,
	exit: exitQuiz,
	studyFlashcards: studyFlashcardsFromQuiz,
};
