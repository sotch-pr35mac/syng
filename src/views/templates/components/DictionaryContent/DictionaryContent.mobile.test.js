import { vi } from 'vitest';
import { render } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { mockBookmarkManager, mockPreferenceManager } from '@test/utils/unitTestUtils.js';
import DictionaryContent from '@/components/DictionaryContent/DictionaryContent.svelte';
import { setBookmarkManagerForTest, setPreferenceManagerForTest } from '@/utils/appServices.js';
import { mobileBreakdown } from '@/stores/mobileBreakdown.js';
import { mobileCharacterWindowWordStore } from '@/stores/mobileCharacterWindowWord.svelte.js';
import { dictionaryDisplaySettingsStore } from '@/stores/dictionaryDisplaySettings.svelte.js';

vi.mock('lucide-svelte', async () => {
	const mockIcon = (await import('@/components/__mocks__/FeatherIcon.svelte')).default;
	return {
		Plus: mockIcon,
		Check: mockIcon,
		Brush: mockIcon,
		Blocks: mockIcon,
		ChevronLeft: mockIcon,
		ChevronRight: mockIcon,
	};
});

vi.mock('@tauri-apps/api/core', () => ({
	invoke: vi.fn(() => Promise.resolve()),
}));

vi.mock('@tauri-apps/plugin-os', () => ({
	platform: () => 'ios',
	version: () => Promise.resolve('17.0'),
}));

// Force the mobile branch of the "Write Characters" action so it sets the store and
// navigates in-app, rather than opening the desktop character window.
vi.mock('@/utils/device.js', () => ({
	isMobile: () => true,
	isIPad: () => false,
	isIos: () => true,
	isAndroid: () => false,
	isMobileLayout: () => true,
}));

const TEST_WORD = {
	hash: 'test-hash',
	simplified: '学',
	traditional: '學',
	english: ['to study'],
	pinyin_marks: ['xué'],
	tones_marks: [2],
	measure_words: [],
};

setBookmarkManagerForTest(
	mockBookmarkManager({
		words: [],
		lists: ['Bookmarks'],
	})
);

it.each([
	['simplified', 'simplified'],
	['traditional', 'traditional'],
	['both', undefined],
])(
	'sets the character-window word and %s preference when Write Characters is tapped',
	async (characterSet, initialScript) => {
		const user = userEvent.setup();
		setPreferenceManagerForTest(mockPreferenceManager({}));
		dictionaryDisplaySettingsStore.setCharacterSet(characterSet);
		mobileCharacterWindowWordStore.set(undefined);

		const { getByText } = render(DictionaryContent, {
			word: TEST_WORD,
			lists: ['Bookmarks'],
		});

		await user.click(getByText('Write Characters'));

		// The displayed word — not whatever was last selected elsewhere — drives the
		// characters screen, because DictionaryContent is the single mobile entry point.
		// (The store is $state-backed, so the value is a reactive proxy: compare by value.)
		expect(mobileCharacterWindowWordStore.value).toEqual(TEST_WORD);
		expect(mobileCharacterWindowWordStore.initialScript).toBe(initialScript);
	}
);

it.each(['#/bookmarks', '#/study/flashcards?list=Review', '#/study/quiz?list=Review'])(
	'opens mobile breakdown from %s with the current entry, script, scroll and bookmark context',
	async (origin) => {
		const user = userEvent.setup();
		setPreferenceManagerForTest(mockPreferenceManager({}));
		dictionaryDisplaySettingsStore.setCharacterSet('both');
		window.location.hash = origin;
		const { getByRole, container } = render(DictionaryContent, {
			word: TEST_WORD,
			lists: ['Bookmarks', 'Review'],
		});
		container.querySelector('.dictionary-content-container').scrollTop = 83;
		await user.click(getByRole('button', { name: 'Character Breakdown', exact: true }));
		expect(window.location.hash).toBe('#/breakdown');
		expect(mobileBreakdown.word).toEqual(TEST_WORD);
		expect(mobileBreakdown.origin).toBe(origin);
		expect(mobileBreakdown.selection).toEqual({ script: 'simplified', index: 0, pinned: null });
		expect(mobileBreakdown.scroll).toBe(83);
		expect(mobileBreakdown.lists).toEqual(['Bookmarks', 'Review']);
	}
);
