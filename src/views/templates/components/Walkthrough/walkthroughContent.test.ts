import { beforeEach, expect, it, vi } from 'vitest';
import type { WalkthroughPreferences } from '@/types/walkthrough.js';
import {
	addExample,
	hasSuitableContent,
	prepareGuide,
} from '@/components/Walkthrough/walkthroughContent.js';
import { invoke } from '@tauri-apps/api/core';
import { bookmarksStore } from '@/stores/bookmarks.svelte.js';
import { readerDocumentsStore } from '@/stores/readerDocuments.svelte.js';
import { invokePrepareReaderImport } from '@/utils/readerDocument.js';

const state = vi.hoisted(() => ({
	lists: ['Bookmarks'] as string[],
	contents: {} as Record<string, { lexical_id: string }[]>,
	documents: [] as { _id: string; title: string }[],
	traditional: false,
	mobile: false,
	ipad: false,
}));
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('@/composables/search.svelte.js', () => ({
	searchStore: { prepareWalkthroughExample: vi.fn() },
}));
vi.mock('@/composables/bookmarks.svelte.js', () => ({
	bookmarksRoute: { setActiveList: vi.fn(), updateListContent: vi.fn(), wordList: [] },
}));
vi.mock('@/composables/quiz.svelte.js', () => ({
	quizRoute: { showAnswer: false, showFinalResults: false },
}));
vi.mock('@/stores/bookmarks.svelte.js', () => ({
	bookmarksStore: {
		get lists() {
			return state.lists;
		},
		refresh: vi.fn(),
		getContent: vi.fn(async (name) => state.contents[name] ?? []),
		createList: vi.fn(async (name) => {
			state.lists.push(name);
			state.contents[name] = [];
		}),
		addToList: vi.fn(async (name, word) => {
			state.contents[name].push(word);
		}),
	},
}));
vi.mock('@/stores/readerDocuments.svelte.js', () => ({
	readerDocumentsStore: {
		get documents() {
			return state.documents;
		},
		refresh: vi.fn(),
		getDocument: vi.fn(async (identifier) =>
			state.documents.find((document) => document._id === identifier)
		),
		importDocument: vi.fn(async (payload) => {
			const document = { _id: 'sample-document', title: payload.title };
			state.documents.push(document);
			return document;
		}),
	},
}));
vi.mock('@/stores/settings.svelte.js', () => ({ settingsActiveTabStore: { set: vi.fn() } }));
vi.mock('@/utils/appServices.js', () => ({
	getPreferenceManager: () => ({ get: () => (state.traditional ? 'traditional' : 'simplified') }),
}));
vi.mock('@/utils/device.js', () => ({
	isMobileLayout: () => state.mobile,
	isIPad: () => state.ipad,
}));
vi.mock('@/utils/readerDocument.js', () => ({
	DEFAULT_READER_DOCUMENT_COLOR: '#ffffff',
	invokePrepareReaderImport: vi.fn(async (args) => args),
	applyReaderImportMetadata: (payload, title, color) => ({ ...payload, title, color }),
}));

let examples: WalkthroughPreferences['examples'];
const remember = (next: WalkthroughPreferences['examples']) => {
	examples = next;
};
beforeEach(() => {
	vi.clearAllMocks();
	state.lists = ['Bookmarks'];
	state.contents = {};
	state.documents = [];
	state.traditional = false;
	state.mobile = false;
	state.ipad = false;
	examples = {};
	vi.mocked(invoke).mockImplementation(async (_command, args: { text: string }) => [
		{ id: `lexical-${args.text}`, simplified: args.text, traditional: args.text },
	]);
	vi.mocked(bookmarksStore.addToList).mockImplementation(async (name, word) => {
		state.contents[name].push(word);
	});
});

it.each([
	{ platform: 'desktop', mobile: false, ipad: false, swipe: false },
	{ platform: 'iPad', mobile: false, ipad: true, swipe: true },
	{ platform: 'phone', mobile: true, ipad: false, swipe: true },
])('describes only supported page navigation on $platform', async ({ mobile, ipad, swipe }) => {
	state.mobile = mobile;
	state.ipad = ipad;
	state.documents = [{ _id: 'story', title: 'Story' }];
	const prepared = await prepareGuide('reader-document', { documentId: 'story' }, () => true);
	const description = prepared.steps.find((step) => step.id === 'pages').body;
	expect(/swipe/i.test(description)).toBe(swipe);
	expect(/page controls/i.test(description)).toBe(!mobile);
});

it('offers personal content and respects quiz minimums without creating examples', async () => {
	state.lists.push('Short', 'Enough');
	state.contents.Short = [{ lexical_id: 'one' }];
	state.contents.Enough = Array.from({ length: 4 }, (_value, index) => ({
		lexical_id: `word-${index}`,
	}));
	const prepared = await prepareGuide('quiz', {}, () => true);
	expect(prepared.choose).toBe('list');
	expect(prepared.choices.map((choice) => choice.context.listName)).toEqual(['Enough']);
	expect(bookmarksStore.createList).not.toHaveBeenCalled();
});

it('creates a distinct sample list and adds only lexical membership, preserving user notes', async () => {
	state.lists.push('Awa’s Tea Party — Sample Words');
	const context = await addExample('list', examples, remember);
	expect(context.listName).toBe('Awa’s Tea Party — Sample Words 2');
	expect(bookmarksStore.addToList).toHaveBeenCalledTimes(21);
	for (const [_name, word] of vi.mocked(bookmarksStore.addToList).mock.calls) {
		expect(Object.keys(word)).toEqual(['lexical_id']);
	}
	expect(examples.listPending).toBe(false);
});

it('reuses suitable samples without restoring removed words', async () => {
	await addExample('list', examples, remember);
	state.contents[examples.listName].pop();
	vi.mocked(bookmarksStore.addToList).mockClear();
	await addExample('list', examples, remember);
	expect(bookmarksStore.addToList).not.toHaveBeenCalled();
	expect(state.contents[examples.listName]).toHaveLength(20);
	const prepared = await prepareGuide('flashcards', {}, () => true);
	expect(prepared.choices).toContainEqual({
		label: 'Awa’s Tea Party — Sample Words (20 words)',
		context: { listName: examples.listName },
	});
});

it.each([
	{ guide: 'flashcards' as const, remaining: 0 },
	{ guide: 'quiz' as const, remaining: 3 },
])(
	'creates a usable sample for $guide while preserving an unsuitable edited sample',
	async ({ guide, remaining }) => {
		await addExample('list', examples, remember);
		const originalName = examples.listName;
		state.contents[originalName] = state.contents[originalName].slice(0, remaining);
		await addExample('list', examples, remember, false, guide);
		expect(examples.listName).toBe('Awa’s Tea Party — Sample Words 2');
		expect(state.contents[originalName]).toHaveLength(remaining);
		expect(state.contents[examples.listName]).toHaveLength(21);
	}
);

it('only considers populated lists and existing documents suitable content', async () => {
	expect(await hasSuitableContent('list')).toBe(false);
	expect(await hasSuitableContent('document')).toBe(false);
	state.contents.Bookmarks = [{ lexical_id: 'one' }];
	state.documents = [{ _id: 'document', title: 'Reading' }];
	expect(await hasSuitableContent('list')).toBe(true);
	expect(await hasSuitableContent('document')).toBe(true);
});

it('retries partial seeding in the same list without duplicating successful entries', async () => {
	let additions = 0;
	vi.mocked(bookmarksStore.addToList).mockImplementation(async (name, word) => {
		additions += 1;
		if (additions === 3) {
			throw new Error('Storage unavailable');
		}
		state.contents[name].push(word);
	});
	await expect(addExample('list', examples, remember)).rejects.toThrow('Storage unavailable');
	expect(examples.listPending).toBe(true);
	await addExample('list', examples, remember);
	expect(bookmarksStore.createList).toHaveBeenCalledTimes(1);
	expect(state.contents[examples.listName]).toHaveLength(21);
	expect(new Set(state.contents[examples.listName].map((entry) => entry.lexical_id)).size).toBe(
		21
	);
});

it('resolves all words before creating a list', async () => {
	vi.mocked(invoke).mockResolvedValue([]);
	await expect(addExample('list', examples, remember)).rejects.toThrow('could not be found');
	expect(bookmarksStore.createList).not.toHaveBeenCalled();
});

it.each([
	{ traditional: false, excerpt: '学习贵在循序渐进' },
	{ traditional: true, excerpt: '學習貴在循序漸進' },
])(
	'imports the story with traditional=$traditional and reuses its ID',
	async ({ traditional, excerpt }) => {
		state.traditional = traditional;
		await addExample('document', examples, remember);
		expect(invokePrepareReaderImport).toHaveBeenCalledWith(
			expect.objectContaining({
				title: 'Awa’s Tea Party — A Story That Levels Up',
				text: expect.stringContaining(excerpt),
			})
		);
		await addExample('document', examples, remember);
		expect(readerDocumentsStore.importDocument).toHaveBeenCalledTimes(1);
		state.documents = [];
		await addExample('document', examples, remember);
		expect(readerDocumentsStore.importDocument).toHaveBeenCalledTimes(2);
	}
);
