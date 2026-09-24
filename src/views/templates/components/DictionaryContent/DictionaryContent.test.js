import { beforeEach, vi } from 'vitest';
import { render, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { invoke } from '@tauri-apps/api/core';
import { mockBookmarkManager, mockPreferenceManager } from '@test/utils/unitTestUtils.js';
import DictionaryContent from '@/components/DictionaryContent/DictionaryContent.svelte';
import { setBookmarkManagerForTest, setPreferenceManagerForTest } from '@/utils/appServices.js';
import { BOOKMARK_LIST_MEMBERSHIP_OPERATIONS } from '@/types/bookmarks.js';
import { NATIVE_COMMANDS } from '@/types/nativeCommands.js';
import { dictionaryDisplaySettingsStore } from '@/stores/dictionaryDisplaySettings.svelte.js';
import { telemetry } from '@/utils/telemetry.js';

vi.mock('@/utils/telemetry.js', () => ({
	telemetry: {
		trackEvent: vi.fn(() => Promise.resolve()),
		trackError: vi.fn(() => Promise.resolve()),
	},
}));

// Mock must be defined with async factory because vi.mock is hoisted before imports
vi.mock('lucide-svelte', async () => {
	const mockIcon = (await import('@/components/__mocks__/FeatherIcon.svelte')).default;
	return {
		Plus: mockIcon,
		Check: mockIcon,
		Brush: mockIcon,
	};
});

// Mock @tauri-apps/api/core
vi.mock('@tauri-apps/api/core', () => ({
	invoke: vi.fn(() => Promise.resolve()),
}));

vi.mock('@tauri-apps/plugin-os', () => ({
	platform: () => 'macos',
	version: () => Promise.resolve('15.0'),
}));

const TEST_WORD = {
	hash: 'test-word',
	simplified: 'A',
	traditional: 'B',
	english: ['test'],
	pinyin_marks: ['a1'],
	tones_marks: [1],
	measure_words: [{ simplified: 'MWA', traditional: 'MWA' }],
};

const STRUCTURED_CLASSIFIER_WORD = {
	...TEST_WORD,
	english: [
		{
			gloss: { value: 'test', sources: ['wiktionary'] },
			measure_words: [
				{
					value: {
						traditional: '隻',
						simplified: '只',
						lexical_id: null,
						varieties: ['hakka'],
					},
					sources: ['wiktionary'],
				},
			],
		},
	],
	measure_words: [
		{
			value: {
				traditional: '樖',
				simplified: '樖',
				lexical_id: '1:cantonese-measure-word',
				varieties: ['cantonese'],
			},
			sources: ['wiktionary'],
		},
	],
};

const STRUCTURED_METADATA_WORD = {
	...TEST_WORD,
	hsk: {
		hsk_2015: [],
		proficiency_standard_2021: [],
		hsk_exam_syllabus_2025: ['One'],
	},
	english: [
		{
			gloss: { value: 'to test', sources: ['cc-cedict'] },
			examples: [],
			commentary: [],
			qualifiers: [],
			lexical_kinds: [],
			parts_of_speech: [
				{ value: 'verb', sources: ['wiktionary'] },
				{ value: 'noun', sources: ['cc-cedict'] },
			],
			alternative_pronunciations: [],
			measure_words: [],
		},
		{
			gloss: { value: 'a test', sources: ['wiktionary'] },
			examples: [],
			commentary: [],
			qualifiers: [],
			lexical_kinds: [],
			parts_of_speech: [{ value: 'verb', sources: ['cc-cedict', 'chinese-notes'] }],
			alternative_pronunciations: [],
			measure_words: [],
		},
	],
};

beforeEach(() => {
	vi.mocked(telemetry.trackEvent).mockClear();
	setPreferenceManagerForTest(mockPreferenceManager({}));
	dictionaryDisplaySettingsStore.setCharacterSet('both');
	vi.mocked(invoke).mockClear();
	setBookmarkManagerForTest(
		mockBookmarkManager({
			words: [],
			lists: ['Bookmarks'],
		})
	);
});

it.each([
	['simplified', 'simplified'],
	['traditional', 'traditional'],
	['both', undefined],
])('opens the character window for the %s preference', async (characterSet, initialScript) => {
	const user = userEvent.setup();
	dictionaryDisplaySettingsStore.setCharacterSet(characterSet);
	const { getByText } = render(DictionaryContent, { word: TEST_WORD });

	await user.click(getByText('Write Characters'));

	expect(invoke).toHaveBeenCalledWith(NATIVE_COMMANDS.WINDOW.OPEN_CHARACTER_WINDOW, {
		word: {
			traditional: TEST_WORD.traditional,
			simplified: TEST_WORD.simplified,
			...(initialScript ? { initialScript } : {}),
		},
	});
});

it('should display the definitions', async () => {
	const { getByText } = render(DictionaryContent, {
		word: TEST_WORD,
	});

	const definition = getByText(TEST_WORD.english[0]);

	expect(definition.textContent).toBe('test');
});

it('scrolls to the top when a different word replaces the current entry', async () => {
	const nextWord = {
		...TEST_WORD,
		hash: 'next-test-word',
		simplified: 'B',
		traditional: 'B',
	};
	const { container, rerender } = render(DictionaryContent, {
		word: TEST_WORD,
	});
	const dictionaryContentElement = container.querySelector('.dictionary-content-container');
	dictionaryContentElement.scrollTop = 240;

	await rerender({ word: nextWord });

	expect(dictionaryContentElement.scrollTop).toBe(0);
});

it('renders HSK and aggregated POS tags with distinct colors', () => {
	const { container, getByText } = render(DictionaryContent, {
		word: STRUCTURED_METADATA_WORD,
	});

	expect(getByText('HSK: 1')).toBeTruthy();
	expect(getByText('Verb')).toBeTruthy();
	expect(getByText('Noun')).toBeTruthy();
	expect(container.querySelectorAll('.sy-tag--yellow')).toHaveLength(1);
	expect(container.querySelectorAll('.sy-tag--blue')).toHaveLength(2);
	expect(getByText('Verb').getAttribute('title')).toBeNull();
	expect(getByText('Noun').getAttribute('title')).toBeNull();
});

it('hides POS tags when dictionary POS display is disabled', () => {
	dictionaryDisplaySettingsStore.setShowPartsOfSpeech(false);
	const { container } = render(DictionaryContent, {
		word: STRUCTURED_METADATA_WORD,
	});

	expect(container.querySelector('.sy-tag--blue')).toBeNull();
});

it('should display the pinyin', async () => {
	const { getByText } = render(DictionaryContent, {
		word: TEST_WORD,
	});

	const pinyin = getByText(TEST_WORD.pinyin_marks[0]);

	expect(pinyin.textContent).toBe('a1');
});

it('should display the characters', async () => {
	const { getByText } = render(DictionaryContent, {
		word: TEST_WORD,
	});

	const simplified = getByText(TEST_WORD.simplified);
	const traditional = getByText(TEST_WORD.traditional);

	expect(simplified.textContent).toBe('A');
	expect(traditional.textContent).toBe('B');
});

it('should emit an event when dictionary link is clicked', async () => {
	const user = userEvent.setup();
	const handleOpenLink = vi.fn();
	const { getByText } = render(DictionaryContent, {
		word: TEST_WORD,
		onlink: handleOpenLink,
	});
	await user.click(getByText('MWA'));
	expect(handleOpenLink).toHaveBeenCalled();
});

it('renders structured classifier references directly without dropping their labels', async () => {
	const user = userEvent.setup();
	const handleOpenLink = vi.fn();
	const { container, getAllByTestId } = render(DictionaryContent, {
		word: STRUCTURED_CLASSIFIER_WORD,
		onlink: handleOpenLink,
	});

	expect(container.textContent).toContain('樖 · Cantonese');
	expect(container.textContent).toContain('只（隻） · Hakka');
	expect(invoke).not.toHaveBeenCalledWith(NATIVE_COMMANDS.DICTIONARY.QUERY_BY_IDS, {
		ids: ['1:cantonese-measure-word'],
	});

	await user.click(getAllByTestId('dictionary-link')[0]);
	expect(handleOpenLink).toHaveBeenCalledWith(
		expect.objectContaining({
			text: '樖',
			lexicalId: '1:cantonese-measure-word',
		})
	);
});

it('reports a successful list membership change', async () => {
	const user = userEvent.setup();
	const onmembershipchange = vi.fn();
	const memberships = ['Bookmarks'];
	setBookmarkManagerForTest({
		waitForInit: () => Promise.resolve(),
		inList: () => Promise.resolve(memberships),
		removeFromList: (_listName, _word) => {
			memberships.length = 0;
			return Promise.resolve();
		},
	});
	const { findByText } = render(DictionaryContent, {
		word: TEST_WORD,
		lists: ['Bookmarks'],
		onmembershipchange,
	});

	const removeAction = await findByText('Remove from Bookmarks');
	await user.click(removeAction.closest('button'));

	await waitFor(() => {
		expect(onmembershipchange).toHaveBeenCalledWith({
			listName: 'Bookmarks',
			lexicalId: TEST_WORD.hash,
			operation: BOOKMARK_LIST_MEMBERSHIP_OPERATIONS.REMOVED,
		});
	});
	expect(telemetry.trackEvent).toHaveBeenCalledWith('bookmark.removed', {});
});

it('reports when a word is added to a list', async () => {
	const user = userEvent.setup();
	const onmembershipchange = vi.fn();
	const memberships = [];
	setBookmarkManagerForTest({
		waitForInit: () => Promise.resolve(),
		inList: () => Promise.resolve(memberships),
		addToList: (_listName, _word) => {
			memberships.push('Bookmarks');
			return Promise.resolve();
		},
	});
	const { findByText } = render(DictionaryContent, {
		word: TEST_WORD,
		lists: ['Bookmarks'],
		onmembershipchange,
	});

	const addAction = await findByText('Add to Bookmarks');
	await user.click(addAction.closest('button'));

	await waitFor(() => {
		expect(onmembershipchange).toHaveBeenCalledWith({
			listName: 'Bookmarks',
			lexicalId: TEST_WORD.hash,
			operation: BOOKMARK_LIST_MEMBERSHIP_OPERATIONS.ADDED,
		});
	});
	expect(telemetry.trackEvent).toHaveBeenCalledWith('bookmark.added', {});
});

it('does not report bookmark success before persistence or after failure', async () => {
	const user = userEvent.setup();
	let failWrite;
	setBookmarkManagerForTest({
		waitForInit: () => Promise.resolve(),
		inList: () => Promise.resolve([]),
		addToList: () =>
			new Promise((_resolve, reject) => {
				failWrite = reject;
			}),
	});
	const alert = vi.spyOn(globalThis, 'alert').mockImplementation(() => {});
	const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
	const { findByText } = render(DictionaryContent, { word: TEST_WORD, lists: ['Bookmarks'] });
	await user.click((await findByText('Add to Bookmarks')).closest('button'));
	expect(telemetry.trackEvent).not.toHaveBeenCalledWith('bookmark.added', expect.anything());
	failWrite(new Error('write failed'));
	await waitFor(() => expect(alert).toHaveBeenCalled());
	expect(telemetry.trackEvent).not.toHaveBeenCalledWith('bookmark.added', expect.anything());
	alert.mockRestore();
	errorLog.mockRestore();
});
