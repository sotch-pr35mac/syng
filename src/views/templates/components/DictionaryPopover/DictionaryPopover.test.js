import { render, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { mockBookmarkManager } from '@test/utils/unitTestUtils.js';
import DictionaryPopover from '@/components/DictionaryPopover/DictionaryPopover.svelte';
import { setBookmarkManagerForTest } from '@/utils/appServices.js';
import { BOOKMARK_LIST_MEMBERSHIP_OPERATIONS } from '@/types/bookmarks.js';

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

const STRUCTURED_CLASSIFIER_RESULT = {
	...RESULTS[0],
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

it('preserves a structured classifier lexical ID for nested popover lookups', async () => {
	const user = userEvent.setup();
	const onlink = vi.fn();
	const { getByText } = render(DictionaryPopover, {
		props: {
			word: STRUCTURED_CLASSIFIER_RESULT,
			results: [STRUCTURED_CLASSIFIER_RESULT],
			anchor: ANCHOR,
			onlink,
		},
	});

	await user.click(getByText('樖'));
	expect(onlink).toHaveBeenCalledWith({
		text: '樖',
		lexicalId: '1:cantonese-measure-word',
	});
});

it('forwards list membership changes from its dictionary content', async () => {
	const user = userEvent.setup();
	const onmembershipchange = vi.fn();
	const memberships = ['Bookmarks'];
	setBookmarkManagerForTest({
		waitForInit: () => Promise.resolve(),
		inList: () => Promise.resolve(memberships),
		removeFromList: () => {
			memberships.length = 0;
			return Promise.resolve();
		},
	});
	const { findByText } = render(DictionaryPopover, {
		props: {
			word: RESULTS[0],
			results: [RESULTS[0]],
			anchor: ANCHOR,
			lists: ['Bookmarks'],
			onmembershipchange,
		},
	});

	const removeAction = await findByText('Remove from Bookmarks');
	await user.click(removeAction.closest('button'));

	await waitFor(() => {
		expect(onmembershipchange).toHaveBeenCalledWith({
			listName: 'Bookmarks',
			lexicalId: RESULTS[0].hash,
			operation: BOOKMARK_LIST_MEMBERSHIP_OPERATIONS.REMOVED,
		});
	});
});
