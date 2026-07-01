import { vi } from 'vitest';
import { render } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { mockBookmarkManager } from '@test/utils/unitTestUtils.js';
import DictionaryContent from '@/components/DictionaryContent/DictionaryContent.svelte';
import { setBookmarkManagerForTest } from '@/utils/appServices.js';
import { mobileCharacterWindowWordStore } from '@/stores/mobileCharacterWindowWord.svelte.js';

vi.mock('lucide-svelte', async () => {
	const mockIcon = (await import('@/components/__mocks__/FeatherIcon.svelte')).default;
	return {
		Plus: mockIcon,
		Check: mockIcon,
		Brush: mockIcon,
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

it('sets the character-window word when Write Characters is tapped (covers reader, search, bookmarks, study)', async () => {
	const user = userEvent.setup();
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
});
