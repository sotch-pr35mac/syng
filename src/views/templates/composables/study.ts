import type { BookmarkWordEntry } from '../stores/bookmarks.svelte.js';

export const PINYIN_QUESTIONS = 'Pinyin';
export const ENGLISH_QUESTIONS = 'English';
export const CHARACTER_QUESTIONS = 'Characters';
export const SIMPLE_QUIZ = 'Simple';
export const GOOD_SCORE_THRESHOLD = 0.8;
export const OKAY_SCORE_THRESHOLD = 0.6;
export const DEFAULT_QUESTION_DURATION = 10;
export const MINIMUM_QUIZ_WORD_COUNT = 4;
export const QUIZ_RESULT_DISPLAY_TIME = 10;
export const EMPTY_FLASHCARDS_LIST_MESSAGE = 'No flashcards in this list';
export const EMPTY_QUIZ_MESSAGE = 'No Questions Available';
export const LOADING_STUDY_MESSAGE = 'Loading...';

type MultipleChoiceQuestion = {
	kind: string;
	question: string;
	options: string[];
	answer: string;
	time_limit: number;
	word_data: BookmarkWordEntry;
};

export type QuizQuestion = {
	question: {
		MultipleChoice: MultipleChoiceQuestion;
	};
	completed: number;
	pending: number;
};

export type AnswerResponse = {
	correct: boolean;
	question: {
		MultipleChoice: MultipleChoiceQuestion;
	};
};

export type ScoreCard = {
	score: number;
	correct: number;
	total: number;
};

export type IncorrectAnswer = {
	response: string;
	question: {
		MultipleChoice: MultipleChoiceQuestion;
	};
};
