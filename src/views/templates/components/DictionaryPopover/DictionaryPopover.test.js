import { render } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
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
	platform: vi.fn(() => 'unknown'),
}));

setBookmarkManagerForTest(
	mockBookmarkManager({
		words: [],
		lists: ['Bookmarks'],
	})
);

const ANCHOR = {
	left: 120,
	right: 180,
	top: 100,
	bottom: 130,
	width: 60,
	height: 30,
};

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
	{
		hash: 'word-3',
		simplified: '重',
		traditional: '重',
		pinyin_marks: 'tong2',
		tone_marks: [2],
		english: ['variant'],
		measure_words: [],
		notes: '',
	},
];

it('should render a count-based result switcher for multiple results', () => {
	const { container, getByText, queryByText } = render(DictionaryPopover, {
		props: {
			word: RESULTS[0],
			results: RESULTS,
			resultIndex: 0,
			anchor: ANCHOR,
		},
	});

	expect(getByText('Result 1 of 3')).not.toBeNull();
	expect(queryByText('重 zhong4')).toBeNull();
	expect(container.querySelectorAll('.dictionary-popover__result-dot')).toHaveLength(3);
});

it('should not render the result switcher for a single result', () => {
	const { queryByText } = render(DictionaryPopover, {
		props: {
			word: RESULTS[0],
			results: [RESULTS[0]],
			resultIndex: 0,
			anchor: ANCHOR,
		},
	});

	expect(queryByText('Result 1 of 1')).toBeNull();
});

it('should select previous, next, and dotted results', async () => {
	const user = userEvent.setup();
	const onselect = vi.fn();
	const { container, getByLabelText } = render(DictionaryPopover, {
		props: {
			word: RESULTS[1],
			results: RESULTS,
			resultIndex: 1,
			anchor: ANCHOR,
			onselect,
		},
	});

	await user.click(getByLabelText('Previous dictionary result'));
	await user.click(getByLabelText('Next dictionary result'));
	await user.click(container.querySelectorAll('.dictionary-popover__result-dot')[2]);

	expect(onselect).toHaveBeenNthCalledWith(1, 0);
	expect(onselect).toHaveBeenNthCalledWith(2, 2);
	expect(onselect).toHaveBeenNthCalledWith(3, 2);
});
