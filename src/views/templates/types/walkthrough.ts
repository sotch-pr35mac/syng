export const WALKTHROUGH_VERSION = 1;
export const WALKTHROUGH_IDS = [
	'app',
	'dictionary',
	'bookmarks',
	'reader-library',
	'reader-document',
	'study',
	'flashcards',
	'quiz',
] as const;
export type WalkthroughId = (typeof WALKTHROUGH_IDS)[number];
export type FeatureWalkthroughId = Extract<
	WalkthroughId,
	'reader-document' | 'flashcards' | 'quiz'
>;
export type WalkthroughContext = { documentId?: string; listName?: string };
export type WalkthroughStatus = 'in-progress' | 'skipped' | 'completed';
export type WalkthroughProgress = {
	status: WalkthroughStatus;
	completed?: boolean;
	stepId?: string;
	context: WalkthroughContext;
};
export type WalkthroughPreferences = {
	version: number;
	invitation: 'eligible' | 'shown' | 'unavailable';
	guides: Partial<Record<WalkthroughId, WalkthroughProgress>>;
	featureInvitations?: Partial<Record<FeatureWalkthroughId, boolean>>;
	examples: { documentId?: string; listName?: string; listPending?: boolean };
};
export const createWalkthroughPreferences = (freshInstall = false): WalkthroughPreferences => ({
	version: WALKTHROUGH_VERSION,
	invitation: freshInstall ? 'eligible' : 'unavailable',
	guides: {},
	examples: {},
});

export type WalkthroughTargetId =
	| 'search-field'
	| 'search-language'
	| 'search-results'
	| 'search-history'
	| 'dictionary-entry'
	| 'dictionary-link'
	| 'dictionary-examples'
	| 'dictionary-popup'
	| 'dictionary-save'
	| 'dictionary-characters'
	| 'dictionary-notes'
	| 'bookmarks-lists'
	| 'bookmarks-management'
	| 'bookmarks-filter'
	| 'bookmarks-words'
	| 'reader-import'
	| 'reader-library'
	| 'reader-page'
	| 'reader-pages'
	| 'reader-settings'
	| 'reader-back'
	| 'study-lists'
	| 'study-navigation'
	| 'study-flashcards'
	| 'study-quiz'
	| 'flashcards-flip'
	| 'flashcards-navigation'
	| 'study-exit'
	| 'quiz-question'
	| 'quiz-options'
	| 'quiz-timer'
	| 'quiz-progress'
	| 'quiz-answer'
	| 'quiz-continue'
	| 'quiz-results'
	| 'quiz-results-actions'
	| 'extras-tabs'
	| 'settings-walkthroughs';

export type WalkthroughStep = {
	id: string;
	title: string;
	body: string;
	target: WalkthroughTargetId;
	fallbackTarget?: WalkthroughTargetId;
	route: string;
	example?: 'document' | 'list';
};
export type WalkthroughChoice = { label: string; context: WalkthroughContext };
export type WalkthroughPreparation = {
	steps: WalkthroughStep[];
	choices?: WalkthroughChoice[];
	choose?: 'document' | 'list';
	context: WalkthroughContext;
};
