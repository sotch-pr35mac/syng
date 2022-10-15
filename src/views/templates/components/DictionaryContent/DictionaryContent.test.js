/* eslint-disable no-undef */
import DictionaryContent from './DictionaryContent.svelte';
import { render } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { mockGlobalTauri } from '../../../../test/utils/unitTestUtils.js';

const TEST_WORD = {
	simplified: 'A',
	traditional: 'B',
	english: ['test'],
	pinyin_marks: ['a1'],
	tones_marks: [1],
	measure_words: [{ simplified: 'MWA', traditional: 'MWA' }]
};

global.__TAURI__ = mockGlobalTauri({
	invoke: {
		open_character_window: value => undefined // eslint-disable-line no-unused-vars
	}
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
	const handleOpenLink = jest.fn();
	const { component, getByText } = render(DictionaryContent, {
		word: TEST_WORD
	});
	component.$on('link', handleOpenLink);
	await user.click(getByText('MWA'));
	expect(handleOpenLink).toHaveBeenCalled();
});
