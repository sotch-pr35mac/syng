import { invoke } from '@tauri-apps/api/core';
import { searchStore } from '@/composables/search.svelte.js';
import { bookmarksRoute } from '@/composables/bookmarks.svelte.js';
import { quizRoute } from '@/composables/quiz.svelte.js';
import { bookmarksStore } from '@/stores/bookmarks.svelte.js';
import { readerDocumentsStore } from '@/stores/readerDocuments.svelte.js';
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
// All carousel words from syng-landing/src/components/Marquee.astro, supplemented
// with additional vocabulary for at least three words per HSK Exam Syllabus 2025 band.
// Levels and readings are checked against the bundled dictionary; ungraded
// carousel words are included without assigning them an HSK level.
const SAMPLE_WORDS: { text: string; pinyin?: string }[] = [
	// HSK 1
	{ text: '朋友' },
	{ text: '茶' },
	{ text: '杯子' },
	// HSK 2
	{ text: '奶茶' },
	{ text: '跳舞' },
	{ text: '生日' },
	// HSK 3
	{ text: '突然' },
	{ text: '奇怪' },
	{ text: '发现' },
	// HSK 4
	{ text: '热闹' },
	{ text: '解释' },
	{ text: '理解' },
	// HSK 5
	{ text: '舍不得' },
	{ text: '挑战' },
	{ text: '想象' },
	// HSK 6
	{ text: '踏实', pinyin: 'ta1shi5' },
	{ text: '圆满' },
	{ text: '探索' },
	// HSK 7–9
	{ text: '缘分' },
	{ text: '惦记' },
	{ text: '体面' },
	{ text: '分寸' },
	{ text: '恰到好处' },
	// No HSK Exam Syllabus 2025 label in the bundled dictionary.
	{ text: '安心' },
	{ text: '从容' },
	{ text: '柳暗花明' },
];
export const SAMPLE_LIST_NAME = 'Sample Words';
export const SAMPLE_DOCUMENT_TITLE = "Awa's Story";
export const SAMPLE_WORD_COUNT = SAMPLE_WORDS.length;
const SAMPLE_TEXT = [
	'阿瓦第一次来昆明。',
	'今天早上，天气很好。天很蓝，也不冷。阿瓦吃完早饭，想出去走一走。',
	'他走在路上，看见很多人，也看见很多树。路边有小店，有卖水果的，也有卖花的。阿瓦觉得这里很漂亮。',
	'走了一会儿，他有一点饿了。',
	'他看见一家米线店，就走了进去。',
	'“你好，一碗米线。”他说。',
	'老板问：“要辣吗？”',
	'阿瓦想了想，说：“一点点。”',
	'米线很热，也很香。阿瓦吃得很慢，但是很开心。吃完以后，他继续往前走。',
	'走着走着，阿瓦闻到了一股咖啡的香味。',
	'他顺着香味走过去，看见一家小咖啡馆，名字叫“图一乐咖啡馆”。',
	'阿瓦走进去。店里不大，但是很舒服。柜台上有咖啡，也有刚做好的肉桂卷。',
	'“我要一杯咖啡，再要一个肉桂卷。”阿瓦说。',
	'店主宁把咖啡和肉桂卷递给他。',
	'肉桂卷还是温的。阿瓦咬了一口，外面有一点甜，里面有肉桂的香味。',
	'“这个很好吃。”他说。',
	'宁笑了笑：“谢谢！欢迎下次再来。”',
	'阿瓦喝着咖啡，看着窗外的人来来往往。他以前只知道云南出茶，没想到昆明也有这么多咖啡馆。',
	'离开咖啡馆以后，阿瓦去了翠湖。',
	'湖边有很多人在散步。有人聊天，有人拍照，还有老人坐在树下休息。几只鸟从湖面飞过去，水里留下了一圈一圈的波纹。',
	'阿瓦沿着湖慢慢走。',
	'这时候，一个老人问他：“你是来昆明旅游的吗？”',
	'“对，我第一次来。”阿瓦回答。',
	'老人笑着说：“那你要慢慢逛。昆明不只是景点多，生活也很有意思。”',
	'阿瓦不太明白“生活很有意思”是什么意思，但他把这句话记住了。',
	'下午，他又去了花市。',
	'花市里颜色很多，声音也很多。有人在问价，有人在挑花，还有店主一边整理花束，一边和熟客聊天。玫瑰、百合、向日葵摆在一起，空气里混着花香、泥土和雨后的潮气。',
	'阿瓦本来只想看看，最后却买了一小束花。',
	'他问店主：“为什么昆明有这么多花？”',
	'店主说：“天气好嘛。这里四季都能种很多东西。”',
	'阿瓦点点头。他忽然发现，昆明给他的感觉，好像不只是“天气好”这么简单。',
	'到了傍晚，天空慢慢暗下来。阿瓦坐上一辆公交车，没有特别想去哪里，只想再看看这座城市。',
	'车经过热闹的路口，也经过安静的小街。窗外有卖水果的小摊，有刚下班的人，有牵着孩子回家的父母，也有年轻人坐在咖啡馆门口聊天。',
	'早上出门的时候，阿瓦还觉得自己是在“看昆明”。',
	'现在，他开始觉得，昆明也在向他展示一种生活。',
	'他原以为认识一座城市，就是去几个有名的地方，拍几张照片，再记住一些街道的名字。可是走了一整天以后，他发现真正留在记忆里的，反而都是很小的事情：一碗微辣的米线，一个还带着温度的肉桂卷，翠湖边陌生人的一句话，还有花市里那股说不清到底来自鲜花还是湿润泥土的气味。',
	'城市似乎就是这样一点一点变得具体的。',
	'地图上的“昆明”只是两个字，而真正的昆明藏在无数细节里。有人每天清晨打开店门，有人坐在湖边晒太阳，有人认真冲一杯咖啡，也有人在黄昏时抱着一束刚买的花回家。',
	'阿瓦终于有些明白老人说的那句话了。',
	'一座城市真正有意思的地方，也许并不在于它有多少值得参观的景点，而在于无数普通的人，日复一日地在这里生活，并且把自己的习惯、记忆和故事留在其中。',
	'这一天，阿瓦并没有走遍昆明。',
	'事实上，他只看到了很小的一部分。',
	'不过他不再着急了。',
	'有些地方不需要一次看完。与其匆匆经过，不如慢一点，喝一杯咖啡，走一段路，偶尔停下来听听别人说话。',
	'等到某一天，你不再需要地图，也知道下一个路口该往哪里走时，也许你才会发现：一座原本陌生的城市，已经悄悄变成了一个你认识的地方。',
].join('\n\n');
const SAMPLE_TRADITIONAL_TEXT = [
	'阿瓦第一次來昆明。',
	'今天早上，天氣很好。天很藍，也不冷。阿瓦吃完早飯，想出去走一走。',
	'他走在路上，看見很多人，也看見很多樹。路邊有小店，有賣水果的，也有賣花的。阿瓦覺得這裡很漂亮。',
	'走了一會兒，他有一點餓了。',
	'他看見一家米線店，就走了進去。',
	'「你好，一碗米線。」他說。',
	'老闆問：「要辣嗎？」',
	'阿瓦想了想，說：「一點點。」',
	'米線很熱，也很香。阿瓦吃得很慢，但是很開心。吃完以後，他繼續往前走。',
	'走著走著，阿瓦聞到了一股咖啡的香味。',
	'他順著香味走過去，看見一家小咖啡館，名字叫「圖一樂咖啡館」。',
	'阿瓦走進去。店裡不大，但是很舒服。櫃檯上有咖啡，也有剛做好的肉桂捲。',
	'「我要一杯咖啡，再要一個肉桂捲。」阿瓦說。',
	'店主寧把咖啡和肉桂捲遞給他。',
	'肉桂捲還是溫的。阿瓦咬了一口，外面有一點甜，裡面有肉桂的香味。',
	'「這個很好吃。」他說。',
	'寧笑了笑：「謝謝！歡迎下次再來。」',
	'阿瓦喝著咖啡，看著窗外的人來來往往。他以前只知道雲南出茶，沒想到昆明也有這麼多咖啡館。',
	'離開咖啡館以後，阿瓦去了翠湖。',
	'湖邊有很多人在散步。有人聊天，有人拍照，還有老人坐在樹下休息。幾隻鳥從湖面飛過去，水裡留下了一圈一圈的波紋。',
	'阿瓦沿著湖慢慢走。',
	'這時候，一個老人問他：「你是來昆明旅遊的嗎？」',
	'「對，我第一次來。」阿瓦回答。',
	'老人笑著說：「那你要慢慢逛。昆明不只是景點多，生活也很有意思。」',
	'阿瓦不太明白「生活很有意思」是什麼意思，但他把這句話記住了。',
	'下午，他又去了花市。',
	'花市裡顏色很多，聲音也很多。有人在問價，有人在挑花，還有店主一邊整理花束，一邊和熟客聊天。玫瑰、百合、向日葵擺在一起，空氣裡混著花香、泥土和雨後的潮氣。',
	'阿瓦本來只想看看，最後卻買了一小束花。',
	'他問店主：「為什麼昆明有這麼多花？」',
	'店主說：「天氣好嘛。這裡四季都能種很多東西。」',
	'阿瓦點點頭。他忽然發現，昆明給他的感覺，好像不只是「天氣好」這麼簡單。',
	'到了傍晚，天空慢慢暗下來。阿瓦坐上一輛公交車，沒有特別想去哪裡，只想再看看這座城市。',
	'車經過熱鬧的路口，也經過安靜的小街。窗外有賣水果的小攤，有剛下班的人，有牽著孩子回家的父母，也有年輕人坐在咖啡館門口聊天。',
	'早上出門的時候，阿瓦還覺得自己是在「看昆明」。',
	'現在，他開始覺得，昆明也在向他展示一種生活。',
	'他原以為認識一座城市，就是去幾個有名的地方，拍幾張照片，再記住一些街道的名字。可是走了一整天以後，他發現真正留在記憶裡的，反而都是很小的事情：一碗微辣的米線，一個還帶著溫度的肉桂捲，翠湖邊陌生人的一句話，還有花市裡那股說不清到底來自鮮花還是濕潤泥土的氣味。',
	'城市似乎就是這樣一點一點變得具體的。',
	'地圖上的「昆明」只是兩個字，而真正的昆明藏在無數細節裡。有人每天清晨打開店門，有人坐在湖邊曬太陽，有人認真沖一杯咖啡，也有人在黃昏時抱著一束剛買的花回家。',
	'阿瓦終於有些明白老人說的那句話了。',
	'一座城市真正有意思的地方，也許並不在於它有多少值得參觀的景點，而在於無數普通的人，日復一日地在這裡生活，並且把自己的習慣、記憶和故事留在其中。',
	'這一天，阿瓦並沒有走遍昆明。',
	'事實上，他只看到了很小的一部分。',
	'不過他不再著急了。',
	'有些地方不需要一次看完。與其匆匆經過，不如慢一點，喝一杯咖啡，走一段路，偶爾停下來聽聽別人說話。',
	'等到某一天，你不再需要地圖，也知道下一個路口該往哪裡走時，也許你才會發現：一座原本陌生的城市，已經悄悄變成了一個你認識的地方。',
].join('\n\n');

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

const SEARCH_LANGUAGE_STEP = step(
	'language',
	'Choose a search language',
	'Syng detects the search language automatically. Select this control to cycle through English (EN), pinyin (PY), and Chinese (ZH).',
	'search-language',
	'/'
);
const CHARACTER_ANIMATION_STEP = step(
	'characters',
	'Explore how characters are written',
	'Write Characters opens character detail, including stroke order where available. Opening it pauses this guide; return here to resume.',
	'dictionary-characters',
	'/',
	{ fallbackTarget: 'dictionary-entry' }
);

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
			steps = [
				step(
					'search',
					'Look up a word',
					'Search with Chinese, English, or pinyin. Select a result to see its meaning. Try your own word whenever you like.',
					'search-field',
					'/'
				),
				SEARCH_LANGUAGE_STEP,
				step(
					'save',
					'Save useful vocabulary',
					'Use + to save this word to Bookmarks. A checkmark means it is saved. With multiple lists, this control lets you choose its lists.',
					'dictionary-save',
					'/',
					{ fallbackTarget: 'search-field' }
				),
				CHARACTER_ANIMATION_STEP,
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
					{ example: 'list', fallbackTarget: 'study-navigation' }
				),
				step(
					'read',
					'Read your own material',
					'Import a document, webpage, or clipboard text. Open it and select unfamiliar words to look them up while you read.',
					'reader-import',
					'/read'
				),
				step(
					'extras',
					'Prepare Chinese text',
					'Extras can add pinyin, convert simplified and traditional characters, and work with tone colors. Choose a tool, enter text, and process it.',
					'extras-tabs',
					'/tools'
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
				SEARCH_LANGUAGE_STEP,
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
				CHARACTER_ANIMATION_STEP,
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
					'management',
					'List Management',
					`${isMobileLayout() ? 'Open List actions' : 'Use these buttons'} to import saved lists, export this list, or delete a custom list. Delete asks for confirmation; the default Bookmarks list is kept.`,
					'bookmarks-management',
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
					2,
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
						'Answer in time',
						'Each question has a countdown. Select the timer to pause if you need more time, then select it again to resume. The countdown is paused during this guide.',
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
	guide?: WalkthroughId | null,
	isCurrent: () => boolean = () => true
): Promise<WalkthroughContext> {
	if (kind === 'document') {
		if (
			!freshCopy &&
			saved.documentId &&
			(await readerDocumentsStore.getDocument(saved.documentId))
		) {
			return { documentId: saved.documentId };
		}
		// Both-script and simplified preferences use the simplified story. Reused documents
		// retain their original text even if the preference has changed since import.
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
		if (isCurrent()) {
			await bookmarksRoute.setActiveList(saved.listName);
		}
		return { listName: saved.listName };
	}
	const words = await Promise.all(
		SAMPLE_WORDS.map(async ({ text, pinyin }) => {
			const matches = await invoke<SearchEntry[]>(
				NATIVE_COMMANDS.DICTIONARY.QUERY_BY_CHINESE,
				{ text }
			);
			const word = matches.find(
				(entry) => entry.simplified === text && (!pinyin || entry.pinyin.numbers === pinyin)
			);
			if (!word) {
				throw new Error(
					'The example vocabulary could not be found in the dictionary. Please try again.'
				);
			}
			return word;
		})
	);
	if (new Set(words.map(lexicalDisplayId)).size !== SAMPLE_WORDS.length) {
		throw new Error('The example needs distinct dictionary entries. Please try again.');
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
	// Finish requested saves even after Skip, but never replace a newer bookmark selection.
	if (isCurrent()) {
		await bookmarksRoute.setActiveList(listName);
	}
	return { listName };
}
