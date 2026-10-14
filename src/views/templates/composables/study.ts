import type { SearchEntry } from '@/types/search.js';

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
export const EMPTY_QUIZ_MESSAGE = `Quiz needs at least ${MINIMUM_QUIZ_WORD_COUNT} words`;
export const LOADING_STUDY_MESSAGE = 'Loading...';

export type QuizCharacterOption = {
	simplified: string;
	traditional: string;
};

export type QuizOption = {
	value: string;
	characters?: QuizCharacterOption;
};

export type MultipleChoiceQuestion = {
	kind: string;
	question: string;
	options: QuizOption[];
	answer: string;
	time_limit: number;
	lexical_unit: SearchEntry;
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

export type StudyAction = 'flashcards' | 'quiz';
export type StudyOrigin = 'bookmarks' | null;
export type StudyContentStatus = 'loading' | 'ready' | 'error';
export type StudyListSummary = { name: string; wordCount: number };

export function getStudyEligibility(wordCount: number, status: StudyContentStatus = 'ready') {
	const ready = status === 'ready';
	return {
		flashcards: ready && wordCount > 0,
		quiz: ready && wordCount >= MINIMUM_QUIZ_WORD_COUNT,
		message: !ready
			? status === 'error'
				? 'Unable to load this list. Try again.'
				: LOADING_STUDY_MESSAGE
			: wordCount === 0
				? 'Add words to this list to start studying.'
				: wordCount < MINIMUM_QUIZ_WORD_COUNT
					? EMPTY_QUIZ_MESSAGE
					: '',
	};
}

export function studyHref(action: StudyAction, list: string, origin: StudyOrigin = null): string {
	return `#/study/${action}?list=${encodeURIComponent(list)}${origin === 'bookmarks' ? '&from=bookmarks' : ''}`;
}
