import { beforeEach, expect, it, vi } from 'vitest';
import type { WalkthroughPreferences } from '@/types/walkthrough.js';
import { addExample, prepareGuide } from '@/components/Walkthrough/walkthroughContent.js';
import { invoke } from '@tauri-apps/api/core';
import { bookmarksStore } from '@/stores/bookmarks.svelte.js';
import { readerDocumentsStore } from '@/stores/readerDocuments.svelte.js';
import { invokePrepareReaderImport } from '@/utils/readerDocument.js';

const state = vi.hoisted(() => ({
	lists: ['Bookmarks'] as string[],
	contents: {} as Record<string, { lexical_id: string }[]>,
	documents: [] as { _id: string; title: string }[],
	traditional: false,
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
vi.mock('@/utils/device.js', () => ({ isMobileLayout: () => false }));
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
	examples = {};
	vi.mocked(invoke).mockImplementation(async (_command, args: { text: string }) => [
		{ id: `lexical-${args.text}`, simplified: args.text, traditional: args.text },
	]);
	vi.mocked(bookmarksStore.addToList).mockImplementation(async (name, word) => {
		state.contents[name].push(word);
	});
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
	state.lists.push('Syng Example Vocabulary');
	const context = await addExample('list', examples, remember);
	expect(context.listName).toBe('Syng Example Vocabulary 2');
	expect(bookmarksStore.addToList).toHaveBeenCalledTimes(6);
	for (const [_name, word] of vi.mocked(bookmarksStore.addToList).mock.calls) {
		expect(Object.keys(word)).toEqual(['lexical_id']);
	}
	expect(examples.listPending).toBe(false);
});

it('reuses completed examples without replacing words the user removed', async () => {
	await addExample('list', examples, remember);
	state.contents[examples.listName] = [];
	vi.mocked(bookmarksStore.addToList).mockClear();
	await addExample('list', examples, remember);
	expect(bookmarksStore.addToList).not.toHaveBeenCalled();
	await addExample('list', examples, remember, true);
	expect(examples.listName).toBe('Syng Example Vocabulary 2');
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
	expect(state.contents[examples.listName]).toHaveLength(6);
	expect(new Set(state.contents[examples.listName].map((entry) => entry.lexical_id)).size).toBe(
		6
	);
});

it('resolves all words before creating a list', async () => {
	vi.mocked(invoke).mockResolvedValue([]);
	await expect(addExample('list', examples, remember)).rejects.toThrow('could not be found');
	expect(bookmarksStore.createList).not.toHaveBeenCalled();
});

it('imports the traditional example through the normal Reader API and reuses its ID', async () => {
	state.traditional = true;
	await addExample('document', examples, remember);
	expect(invokePrepareReaderImport).toHaveBeenCalledWith(
		expect.objectContaining({ text: expect.stringContaining('學習中文') })
	);
	await addExample('document', examples, remember);
	expect(readerDocumentsStore.importDocument).toHaveBeenCalledTimes(1);
	state.documents = [];
	await addExample('document', examples, remember);
	expect(readerDocumentsStore.importDocument).toHaveBeenCalledTimes(2);
});
