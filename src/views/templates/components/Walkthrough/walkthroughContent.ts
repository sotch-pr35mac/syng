import { invoke } from '@tauri-apps/api/core';
import { searchStore } from '@/composables/search.svelte.js';
import { bookmarksRoute } from '@/composables/bookmarks.svelte.js';
import { quizRoute } from '@/composables/quiz.svelte.js';
import { bookmarksStore } from '@/stores/bookmarks.svelte.js';
import { readerDocumentsStore } from '@/stores/readerDocuments.svelte.js';
import { settingsActiveTabStore } from '@/stores/settings.svelte.js';
import { getPreferenceManager } from '@/utils/appServices.js';
import { isIPad, isMobileLayout } from '@/utils/device.js';
import { resolveNameConflict } from '@/utils/name.js';
import {
	applyReaderImportMetadata,
	invokePrepareReaderImport,
	DEFAULT_READER_DOCUMENT_COLOR,
} from '@/utils/readerDocument.js';
import { MINIMUM_QUIZ_WORD_COUNT, studyHref } from '@/composables/study.js';
import { NATIVE_COMMANDS } from '@/types/nativeCommands.js';
import { lexicalDisplayId } from '@/types/dictionary.js';
import type { SearchEntry } from '@/types/search.js';
import type {
	WalkthroughId,
	WalkthroughContext,
	WalkthroughPreparation,
	WalkthroughPreferences,
	WalkthroughStep,
	WalkthroughTargetId,
} from '@/types/walkthrough.js';

export const GUIDE_LABELS: Record<WalkthroughId, string> = {
	app: 'App tour',
	dictionary: 'Dictionary',
	bookmarks: 'Bookmarks',
	'reader-library': 'Importing and your library',
	'reader-document': 'Reading a document',
	study: 'Choosing what to study',
	flashcards: 'Flashcards',
	quiz: 'Quizzes',
};
const SAMPLE_WORDS = ['学习', '中文', '朋友', '老师', '书', '今天'];
const SAMPLE_LIST_NAME = 'Syng Example Vocabulary';
const SAMPLE_DOCUMENT_TITLE = 'Syng Example — Learning';
const SAMPLE_TEXT =
	'今天，我和朋友一起学习中文。\n\n我们在学校看书。老师说：“每天学习一点，你会慢慢进步。”\n\n朋友喜欢读故事，我喜欢写字。我们一边看书，一边学习新词。\n\n回家以后，我把今天学到的词再看一遍。明天，我们还要一起学习。';
const SAMPLE_TRADITIONAL_TEXT =
	'今天，我和朋友一起學習中文。\n\n我們在學校看書。老師說：「每天學習一點，你會慢慢進步。」\n\n朋友喜歡讀故事，我喜歡寫字。我們一邊看書，一邊學習新詞。\n\n回家以後，我把今天學到的詞再看一遍。明天，我們還要一起學習。';

function step(
	id: string,
	title: string,
	body: string,
	target: WalkthroughTargetId,
	route: string,
	options: Partial<WalkthroughStep> = {}
): WalkthroughStep {
	return { id, title, body, target, route, ...options };
}

export async function hasSuitableContent(kind: 'document' | 'list'): Promise<boolean> {
	if (kind === 'document') {
		await readerDocumentsStore.refresh();
		return readerDocumentsStore.documents.length > 0;
	}
	await bookmarksStore.refresh();
	const contents = await Promise.all(
		bookmarksStore.lists.map((listName) => bookmarksStore.getContent(listName))
	);
	return contents.some((words) => words.length > 0);
}

export async function prepareGuide(
	identifier: WalkthroughId,
	context: WalkthroughContext,
	isCurrent: () => boolean
): Promise<WalkthroughPreparation> {
	let steps: WalkthroughStep[] = [];
	if (identifier === 'app' || identifier === 'dictionary') {
		await searchStore.prepareWalkthroughExample(isCurrent);
	}
	if (identifier === 'reader-document') {
		await readerDocumentsStore.refresh();
		if (
			!context.documentId ||
			!readerDocumentsStore.documents.some((document) => document._id === context.documentId)
		) {
			return {
				steps,
				context: {},
				choose: 'document',
				choices: readerDocumentsStore.documents.map((document) => ({
					label: document.title,
					context: { documentId: document._id },
				})),
			};
		}
	}
	if (identifier === 'flashcards' || identifier === 'quiz') {
		await bookmarksStore.refresh();
		const minimum = identifier === 'quiz' ? MINIMUM_QUIZ_WORD_COUNT : 1;
		const listContents = await Promise.all(
			bookmarksStore.lists.map(async (listName) => ({
				listName,
				count: (await bookmarksStore.getContent(listName)).length,
			}))
		);
		if (
			!context.listName ||
			!listContents.some(
				(list) => list.listName === context.listName && list.count >= minimum
			)
		) {
			return {
				steps,
				context: {},
				choose: 'list',
				choices: listContents
					.filter((list) => list.count >= minimum)
					.map((list) => ({
						label: `${list.listName} (${list.count} words)`,
						context: { listName: list.listName },
					})),
			};
		}
	}
	if (!isCurrent()) {
		return { steps, context };
	}
	const studyOrigin = new URLSearchParams(window.location.hash.split('?')[1]).get('from');
	const studyRoute =
		identifier === 'flashcards' || identifier === 'quiz'
			? studyHref(
					identifier,
					context.listName ?? '',
					studyOrigin === 'bookmarks' ? 'bookmarks' : null
				).slice(1)
			: '';
	switch (identifier) {
		case 'app':
			settingsActiveTabStore.set('general');
			steps = [
				step(
					'search',
					'Look up a word',
					'Search with Chinese, English, or pinyin. Select a result to see its meaning. Try your own word whenever you like.',
					'search-field',
					'/'
				),
				step(
					'save',
					'Save useful vocabulary',
					'Use + to save this word to Bookmarks. A checkmark means it is saved. With multiple lists, this control lets you choose its lists.',
					'dictionary-save',
					'/',
					{ fallbackTarget: 'search-field' }
				),
				step(
					'bookmarks',
					'Organize your words',
					'Find your saved vocabulary here. Open the list selector and choose Create New to organize words by lesson, book, or topic.',
					'bookmarks-lists',
					'/bookmarks'
				),
				step(
					'study',
					'Practice what you save',
					'Choose a saved list for flashcards or a quiz. Quizzes need at least four words.',
					'study-lists',
					'/study',
					{ example: 'list' }
				),
				step(
					'read',
					'Read your own material',
					'Import a document, webpage, or clipboard text. Open it and select unfamiliar words to look them up while you read.',
					'reader-import',
					'/read',
					{ example: 'document' }
				),
				step(
					'extras',
					'Prepare Chinese text',
					'Extras can add pinyin, convert simplified and traditional characters, and work with tone colors. Choose a tool, enter text, and process it.',
					'extras-tabs',
					'/tools'
				),
				step(
					'settings',
					'Make Syng yours',
					'Adjust character display and tone colors in General. Find every guide in Settings → Walkthrough whenever you need a refresher.',
					'settings-walkthroughs',
					'/settings'
				),
			];
			break;
		case 'dictionary':
			steps = [
				step(
					'search',
					'Start with a word or phrase',
					'Enter Chinese, English, or pinyin. Select a result to open the dictionary entry.',
					'search-field',
					'/'
				),
				step(
					'language',
					'Choose a search language',
					'Syng detects the search language automatically. Select this control to cycle through English (EN), pinyin (PY), and Chinese (ZH).',
					'search-language',
					'/'
				),
				step(
					'meaning',
					'Understand the entry',
					'Read the characters, pinyin, and definitions here.',
					'dictionary-entry',
					'/',
					{ fallbackTarget: 'search-results' }
				),
				step(
					'links',
					'Look up blue links without leaving the page',
					'Select a blue word in an example sentence or definition to open the popup dictionary without leaving this page.',
					'dictionary-examples',
					'/',
					{ fallbackTarget: 'dictionary-link' }
				),
				step(
					'save',
					'Keep useful words',
					'Use + to save a word. A checkmark shows saved membership; open this control to change its lists. You can add notes when viewing saved vocabulary in Bookmarks.',
					'dictionary-save',
					'/',
					{ fallbackTarget: 'search-field' }
				),
				step(
					'characters',
					'Explore how characters are written',
					'Write Characters opens character detail, including stroke order where available. Opening it pauses this guide; return here to resume.',
					'dictionary-characters',
					'/',
					{ fallbackTarget: 'dictionary-entry' }
				),
			];
			if (!isMobileLayout()) {
				steps.push(
					step(
						'history',
						'Revisit dictionary entries',
						'These arrows move through the entries you have opened during this session. They become available as you look up more words.',
						'search-history',
						'/'
					)
				);
			}
			break;
		case 'bookmarks': {
			await bookmarksRoute.updateListContent();
			steps = [
				step(
					'lists',
					'Choose or create a list',
					'Open this selector to switch lists or choose Create New. Your default Bookmarks list is always available.',
					'bookmarks-lists',
					'/bookmarks'
				),
				step(
					'words',
					'Find your vocabulary',
					'Save words from a dictionary entry with +. They appear in the selected list here.',
					'bookmarks-words',
					'/bookmarks',
					{ example: 'list' }
				),
			];
			if (bookmarksRoute.wordList.length) {
				steps.splice(
					1,
					0,
					step(
						'filter',
						'Find a saved word',
						'Filter the current list, then select a word to see its entry.',
						'bookmarks-filter',
						'/bookmarks'
					)
				);
				steps.push(
					step(
						'notes',
						'Make the meaning your own',
						'Select a saved word, then scroll to Notes to add a reminder or example sentence. Notes save as you type.',
						'dictionary-notes',
						'/bookmarks',
						{ fallbackTarget: 'bookmarks-words' }
					),
					step(
						'membership',
						'Manage list membership',
						'In an open entry, use the checkmark or list menu to change where the word is saved. Removing a membership takes the word out of that list.',
						'dictionary-save',
						'/bookmarks',
						{ fallbackTarget: 'bookmarks-words' }
					)
				);
			}
			break;
		}
		case 'reader-library':
			steps = [
				step(
					'import',
					'Bring something to read',
					'Import a document, a webpage, or text from your clipboard. Document import explains supported formats. Scanned PDFs need extractable text.',
					'reader-import',
					'/read',
					{ example: 'document' }
				),
				step(
					'library',
					'Keep your reading together',
					'Open a document to read from your saved place. Use Edit to manage your library. Find the reading guide in Settings → Walkthrough.',
					'reader-library',
					'/read'
				),
			];
			break;
		case 'reader-document': {
			const route = `/read/document/${encodeURIComponent(context.documentId)}`;
			steps = [
				step(
					'lookup',
					'Look up words as you read',
					'Select a Chinese word to open its dictionary entry. Use + there to save useful vocabulary. Your reading stays in place.',
					'reader-page',
					route
				),
				step(
					'pages',
					'Move through the document',
					isMobileLayout()
						? 'Swipe across the page to keep reading. Syng saves your reading place.'
						: isIPad()
							? 'Use the page controls or swipe across the page to keep reading. Syng saves your reading place.'
							: 'Use the page controls to move through your document. Syng saves your reading place.',
					'reader-pages',
					route,
					{ fallbackTarget: 'reader-page' }
				),
				step(
					'appearance',
					'Make reading comfortable',
					'Open Reader settings to adjust text size and choose a light, dark, sepia, or automatic theme.',
					'reader-settings',
					route
				),
				step(
					'library',
					'Return to your library',
					'Use this control to choose another document. You can return to this guide from Settings → Walkthrough.',
					'reader-back',
					route
				),
			];
			break;
		}
		case 'study':
			steps = [
				step(
					'lists',
					'Choose what to practice',
					'Study uses your saved vocabulary lists. Save words from Search or Reader, then choose a list here.',
					'study-lists',
					'/study',
					{ example: 'list' }
				),
				step(
					'flashcards',
					'Review with flashcards',
					'Choose the flashcards control beside a list. Flip each card to reveal its entry, then move at your own pace.',
					'study-flashcards',
					'/study',
					{ fallbackTarget: 'study-lists' }
				),
				step(
					'quiz',
					'Check your recall',
					'Choose the quiz control beside a list with at least four words. Questions mix characters, English, and pinyin; review incorrect answers at the end.',
					'study-quiz',
					'/study',
					{ fallbackTarget: 'study-lists' }
				),
			];
			break;
		case 'flashcards':
			steps = [
				step(
					'flip',
					'Reveal the entry',
					'Try remembering the meaning, then select Flip to reveal or hide the dictionary entry.',
					'flashcards-flip',
					studyRoute
				),
				step(
					'navigate',
					'Practice at your own pace',
					'Use Previous and Next to move through this list. You can flip or revisit cards as often as you like.',
					'flashcards-navigation',
					studyRoute
				),
				step(
					'exit',
					'Choose another list',
					'Exit returns to Study. Your flashcard position is remembered during this app session.',
					'study-exit',
					studyRoute
				),
			];
			break;
		case 'quiz':
			if (
				window.location.hash.startsWith('#/study/quiz') &&
				quizRoute.activeList === context.listName &&
				quizRoute.showFinalResults
			) {
				steps = [
					step(
						'results',
						'Review this session',
						'See your score and revisit incorrect answers here. These results describe this quiz session.',
						'quiz-results',
						studyRoute
					),
					step(
						'again',
						'Keep practicing',
						'Retake starts another quiz. Flashcards lets you review this list at your own pace.',
						'quiz-results-actions',
						studyRoute
					),
				];
			} else if (
				window.location.hash.startsWith('#/study/quiz') &&
				quizRoute.activeList === context.listName &&
				quizRoute.showAnswer
			) {
				steps = [
					step(
						'answer',
						'Review the answer',
						'Read the dictionary entry and compare it with your answer. Guide instructions pause the result countdown.',
						'quiz-answer',
						studyRoute
					),
					step(
						'continue',
						'Continue when ready',
						'Continue opens the next question; Finish opens the session results. Your timer resumes after closing this guide.',
						'quiz-continue',
						studyRoute
					),
				];
			} else {
				steps = [
					step(
						'question',
						'Read the prompt',
						'Questions may show characters, English, or pinyin. Match the prompt to the right answer below.',
						'quiz-question',
						studyRoute
					),
					step(
						'answers',
						'Choose an answer',
						'Select one answer. You will see whether it was correct and can review the dictionary entry afterward. Trying an answer pauses this guide.',
						'quiz-options',
						studyRoute
					),
					step(
						'timer',
						'Take your time with the guide',
						'The quiz timer is suspended while these instructions are open. Closing the guide resumes the remaining time.',
						'quiz-timer',
						studyRoute
					),
					step(
						'progress',
						'Follow your progress',
						'The progress indicator tracks this session. Exit returns to Study; completed quizzes show a score and incorrect answers.',
						'quiz-progress',
						studyRoute,
						{ fallbackTarget: 'study-exit' }
					),
				];
			}
			break;
	}
	return { steps, context };
}

export async function addExample(
	kind: 'document' | 'list',
	saved: WalkthroughPreferences['examples'],
	remember: (examples: WalkthroughPreferences['examples']) => void,
	freshCopy = false,
	guide?: WalkthroughId | null
): Promise<WalkthroughContext> {
	if (kind === 'document') {
		if (
			!freshCopy &&
			saved.documentId &&
			(await readerDocumentsStore.getDocument(saved.documentId))
		) {
			return { documentId: saved.documentId };
		}
		const traditional = getPreferenceManager().get('characterSet') === 'traditional';
		const payload = await invokePrepareReaderImport({
			title: SAMPLE_DOCUMENT_TITLE,
			text: traditional ? SAMPLE_TRADITIONAL_TEXT : SAMPLE_TEXT,
			fileName: 'syng-example.txt',
			mimeType: 'text/plain',
		});
		const document = await readerDocumentsStore.importDocument(
			applyReaderImportMetadata(payload, SAMPLE_DOCUMENT_TITLE, DEFAULT_READER_DOCUMENT_COLOR)
		);
		remember({ ...saved, documentId: document._id });
		return { documentId: document._id };
	}
	await bookmarksStore.refresh();
	if (
		!freshCopy &&
		saved.listName &&
		bookmarksStore.lists.includes(saved.listName) &&
		!saved.listPending &&
		(await bookmarksStore.getContent(saved.listName)).length >=
			(guide === 'quiz' ? MINIMUM_QUIZ_WORD_COUNT : 1)
	) {
		await bookmarksRoute.setActiveList(saved.listName);
		return { listName: saved.listName };
	}
	const words = await Promise.all(
		SAMPLE_WORDS.map(async (text) => {
			const matches = await invoke<SearchEntry[]>(
				NATIVE_COMMANDS.DICTIONARY.QUERY_BY_CHINESE,
				{ text }
			);
			const word = matches.find((entry) => entry.simplified === text);
			if (!word) {
				throw new Error(
					'The example vocabulary could not be found in the dictionary. Please try again.'
				);
			}
			return word;
		})
	);
	if (new Set(words.map(lexicalDisplayId)).size !== SAMPLE_WORDS.length) {
		throw new Error('The example needs six distinct dictionary entries. Please try again.');
	}
	const reusePending =
		!freshCopy &&
		saved.listPending &&
		saved.listName &&
		bookmarksStore.lists.includes(saved.listName);
	const listName = reusePending
		? saved.listName
		: resolveNameConflict(SAMPLE_LIST_NAME, bookmarksStore.lists);
	if (!reusePending) {
		await bookmarksStore.createList(listName);
	}
	remember({ ...saved, listName, listPending: true });
	const existingIds = new Set(
		(await bookmarksStore.getContent(listName)).map((entry) => entry.lexical_id)
	);
	for (const word of words) {
		const lexicalId = lexicalDisplayId(word);
		if (!existingIds.has(lexicalId)) {
			await bookmarksStore.addToList(listName, { lexical_id: lexicalId });
		}
	}
	remember({ ...saved, listName, listPending: false });
	await bookmarksRoute.setActiveList(listName);
	return { listName };
}
