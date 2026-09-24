import { invoke } from '@tauri-apps/api/core';
import { bookmarksStore } from '@/stores/bookmarks.svelte.js';
import { studySubRouteStore } from '@/stores/studyRoute.svelte.js';
import { NATIVE_COMMANDS } from '@/types/nativeCommands.js';
import type { SearchEntry } from '@/types/search.js';
import { createDictionaryPopover } from '@/composables/dictionaryPopover.svelte.js';
import { handleError, telemetry } from '@/utils/index.js';
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
} from '@/composables/study.js';

let quizActiveList = $state<string | null>(null);
let quizQuestion = $state<QuizQuestion | undefined>(undefined);
let quizShowAnswer = $state(false);
let quizAnswer = $state<SearchEntry | undefined>(undefined);
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
// Dictionary popover for cross-reference links (e.g. measure words) tapped inside the answer's
// DictionaryContent. Shared with flashcards via createDictionaryPopover.
const popover = createDictionaryPopover('quiz');
const EMPTY_QUIZ_ERROR = new Error('EMPTY_QUIZ');
let quizRequest = 0;
let quizStarting = false;
let quizContinuing = false;
let quizAnswerPending = false;
let sessionActive = false;
let answeredCount = 0;

function endSession(): void {
	quizRequest += 1;
	quizStarting = false;
	quizContinuing = false;
	quizAnswerPending = false;
	popover.close();
	if (!sessionActive) {
		return;
	}
	sessionActive = false;
	telemetry.trackEvent('quiz.abandoned', { answered_count: answeredCount }).catch(() => {});
}

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
	if (quizStarting && quizActiveList === activeList) {
		return;
	}
	endSession();
	const requestId = ++quizRequest;
	answeredCount = 0;
	quizActiveList = activeList;
	resetQuizState();
	studySubRouteStore.set('quiz');

	if (!quizActiveList) {
		quizLoading = false;
		return;
	}
	quizStarting = true;
	let wordCount = 0;

	void bookmarksStore
		.getContent(quizActiveList)
		.then((contents) => {
			if (requestId !== quizRequest) {
				return Promise.reject(EMPTY_QUIZ_ERROR);
			}
			wordCount = contents.length;
			if (contents.length < MINIMUM_QUIZ_WORD_COUNT) {
				quizLoading = false;
				return Promise.reject(EMPTY_QUIZ_ERROR);
			}

			return invoke(NATIVE_COMMANDS.QUIZ.START, {
				config: {
					lexical_ids: contents.map((entry) => entry.lexical_id),
					kind: SIMPLE_QUIZ,
					question_kinds: [PINYIN_QUESTIONS, ENGLISH_QUESTIONS, CHARACTER_QUESTIONS],
				},
			});
		})
		.then(() => {
			if (requestId !== quizRequest) {
				return Promise.reject(EMPTY_QUIZ_ERROR);
			}
			return invoke<QuizQuestion>(NATIVE_COMMANDS.QUIZ.NEXT_QUESTION);
		})
		.then((nextQuestion) => {
			if (requestId !== quizRequest) {
				return undefined;
			}
			handleQuestionChange(nextQuestion);
			sessionActive = true;
			telemetry.trackEvent('quiz.started', { word_count: wordCount }).catch(() => {});
			return undefined;
		})
		.catch((error) => {
			if (requestId !== quizRequest || error === EMPTY_QUIZ_ERROR) {
				return;
			}

			quizLoading = false;
			handleError(
				'There was an error starting the quiz. Check the log for more details.',
				error
			);
		})
		.finally(() => {
			if (requestId === quizRequest) {
				quizStarting = false;
			}
		});
}

function answerQuestion(response: string): Promise<boolean> {
	if (!quizQuestion || quizShowAnswer || quizAnswerPending || quizFinalScore !== undefined) {
		return Promise.resolve(false);
	}

	quizChosenAnswer = response;
	quizAnswerPending = true;
	const requestId = quizRequest;
	const answeredIn = Math.round((Date.now() - quizQuestionStartTime) / 1000);
	return invoke<AnswerResponse>(NATIVE_COMMANDS.QUIZ.ANSWER, {
		response: {
			response,
			answered_in: answeredIn,
		},
	})
		.then((answerResponse) => {
			if (requestId !== quizRequest) {
				return false;
			}
			answeredCount += 1;
			quizAnswer = answerResponse.question.MultipleChoice.lexical_unit;
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
		})
		.finally(() => {
			if (requestId === quizRequest) {
				quizAnswerPending = false;
			}
		});
}

function continueQuiz(): void {
	if (quizContinuing || !sessionActive || !quizShowAnswer || quizFinalScore !== undefined) {
		return;
	}
	quizContinuing = true;
	const requestId = quizRequest;
	quizShowResult = quizQuestionsPending > 1 ? false : true;
	if (quizQuestionsPending > 1) {
		void invoke<QuizQuestion>(NATIVE_COMMANDS.QUIZ.NEXT_QUESTION)
			.then((nextQuestion) => {
				if (requestId !== quizRequest) {
					return undefined;
				}
				handleQuestionChange(nextQuestion);
				return undefined;
			})
			.catch((error) => {
				handleError('There was an error getting the next question.', error);
			})
			.finally(() => {
				if (requestId === quizRequest) {
					quizContinuing = false;
				}
			});
		return;
	}

	void invoke<ScoreCard>(NATIVE_COMMANDS.QUIZ.SCORE)
		.then((score) => {
			if (requestId !== quizRequest) {
				return [];
			}
			quizFinalScore = score.score;
			quizFinalCorrect = score.correct;
			quizFinalTotal = score.total;
			sessionActive = false;
			telemetry
				.trackEvent('quiz.completed', {
					question_count: score.total,
					correct_count: score.correct,
					score: score.score,
				})
				.catch(() => {});
			return invoke<IncorrectAnswer[]>(NATIVE_COMMANDS.QUIZ.INCORRECT);
		})
		.then((incorrect) => {
			if (requestId !== quizRequest) {
				return undefined;
			}
			quizFinalIncorrect = incorrect;
			return undefined;
		})
		.catch((error) => {
			handleError('There was an error getting the next question.', error);
		})
		.finally(() => {
			if (requestId === quizRequest) {
				quizContinuing = false;
			}
		});
}

function retakeQuiz(): void {
	startQuiz(quizActiveList);
}

function exitQuiz(): void {
	endSession();
	studySubRouteStore.set(null);
	window.location.hash = '#/study';
}

function studyFlashcardsFromQuiz(): void {
	if (quizActiveList) {
		window.location.hash = `#/study/flashcards?list=${encodeURIComponent(quizActiveList)}`;
	}
}

export const quizRoute = {
	endSession,
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
	get answer(): SearchEntry | undefined {
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
	get popoverWord(): SearchEntry | undefined {
		return popover.word;
	},
	get popoverResults(): SearchEntry[] {
		return popover.results;
	},
	get popoverResultIndex(): number {
		return popover.resultIndex;
	},
	get popoverReopenKey(): number {
		return popover.reopenKey;
	},
	get popoverAnchor(): DOMRect | undefined {
		return popover.anchor;
	},
	start: startQuiz,
	reset: resetQuizState,
	answerQuestion,
	continue: continueQuiz,
	retake: retakeQuiz,
	exit: exitQuiz,
	studyFlashcards: studyFlashcardsFromQuiz,
	lookupPopoverWord: popover.lookup,
	selectPopoverResult: popover.select,
	closePopoverDictionary: popover.close,
};
