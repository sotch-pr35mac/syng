/* eslint-disable no-undef */
import { vi } from 'vitest';
import { render } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { mockBookmarkManager } from '../../../../test/utils/unitTestUtils.js';
import DictionaryContent from './DictionaryContent.svelte';

// Mock must be defined with async factory because vi.mock is hoisted before imports
vi.mock('svelte-feather-icons', async () => {
	const mockFeatherIcon = (await import('../__mocks__/FeatherIcon.svelte')).default;
	return {
		PlusIcon: mockFeatherIcon,
		CheckIcon: mockFeatherIcon,
		Maximize2Icon: mockFeatherIcon,
	};
});

// Mock @tauri-apps/api/core
vi.mock('@tauri-apps/api/core', () => ({
	invoke: vi.fn(() => Promise.resolve())
}));

const TEST_WORD = {
	simplified: 'A',
	traditional: 'B',
	english: ['test'],
	pinyin_marks: ['a1'],
	tones_marks: [1],
	measure_words: [{ simplified: 'MWA', traditional: 'MWA' }]
};

global.bookmarkManager = mockBookmarkManager({
	words: [],
	lists: ['Bookmarks']
});

it('should display the definitions', async () => {
	const { getByText } = render(DictionaryContent, {
		word: TEST_WORD
	});

	const definition = getByText(TEST_WORD.english[0]);

	expect(definition.textContent).toBe('test');
});

it('should display the pinyin', async () => {
	const { getByText } = render(DictionaryContent, {
		word: TEST_WORD
	});

	const pinyin = getByText(TEST_WORD.pinyin_marks[0]);

	expect(pinyin.textContent).toBe('a1');
});

it('should display the characters', async () => {
	const { getByText } = render(DictionaryContent, {
		word: TEST_WORD
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
		onlink: handleOpenLink
	});
	await user.click(getByText('MWA'));
	expect(handleOpenLink).toHaveBeenCalled();
});