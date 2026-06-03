import { render } from '@testing-library/svelte';
import { vi } from 'vitest';
import { mockBookmarkManager } from '@test/utils/unitTestUtils.js';
import DictionaryPopover from '@/components/DictionaryPopover/DictionaryPopover.svelte';
import { setBookmarkManagerForTest } from '@/utils/appServices.js';

vi.mock('lucide-svelte', async () => {
	const mockIcon = (await import('@/components/__mocks__/FeatherIcon.svelte')).default;
	return {
		Brush: mockIcon,
		Check: mockIcon,
		ChevronLeft: mockIcon,
		ChevronRight: mockIcon,
		Plus: mockIcon,
		X: mockIcon,
	};
});

vi.mock('@tauri-apps/api/core', () => ({
	invoke: vi.fn(() => Promise.resolve()),
}));

vi.mock('@tauri-apps/plugin-os', () => ({
	platform: vi.fn(() => 'ios'),
}));

setBookmarkManagerForTest(
	mockBookmarkManager({
		words: [],
		lists: ['Bookmarks'],
	})
);

const RESULTS = [
	{
		hash: 'word-1',
		simplified: '重',
		traditional: '重',
		pinyin_marks: 'zhong4',
		tone_marks: [4],
		english: ['heavy'],
		measure_words: [],
		notes: '',
	},
	{
		hash: 'word-2',
		simplified: '重',
		traditional: '重',
		pinyin_marks: 'chong2',
		tone_marks: [2],
		english: ['again'],
		measure_words: [],
		notes: '',
	},
];

it('should hide result dots in the mobile popover', () => {
	const { container, getByText } = render(DictionaryPopover, {
		props: {
			word: RESULTS[0],
			results: RESULTS,
			resultIndex: 0,
		},
	});

	expect(getByText('Result 1 of 2')).not.toBeNull();
	expect(container.querySelector('.sy-snap-sheet')).not.toBeNull();
	expect(container.querySelector('.dictionary-popover__result-dot')).toBeNull();
});
