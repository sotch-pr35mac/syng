/* eslint-disable no-undef */
import DictionaryContent from './DictionaryContent.svelte';
import { render } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';

const TEST_WORD = {
	simplified: 'A',
	traditional: 'B',
	english: ['test'],
	pinyinMarks: ['a1'],
	tonesMarks: [1],
	measureWords: [{ simplified: 'MWA', traditional: 'MWA' }]
};

it('should display the definitions', async () => {
	window.require = jest.fn().mockReturnValue(() => {});
	const { getByText } = render(DictionaryContent, {
		word: TEST_WORD
	});

	const definition = getByText(TEST_WORD.english[0]);

	expect(definition.textContent).toBe('test');
});

it('should display the pinyin', async () => {
	window.require = jest.fn().mockReturnValue(() => {});
	const { getByText } = render(DictionaryContent, {
		word: TEST_WORD
	});

	const pinyin = getByText(TEST_WORD.pinyinMarks[0]);

	expect(pinyin.textContent).toBe('a1');
});

it('should display the characters', async () => {
	window.require = jest.fn().mockReturnValue(() => {});
	const { getByText } = render(DictionaryContent, {
		word: TEST_WORD
	});

	const simplified = getByText(TEST_WORD.simplified);
	const traditional = getByText(TEST_WORD.traditional);

	expect(simplified.textContent).toBe('A');
	expect(traditional.textContent).toBe('B');
});

it('should emit an event when dictionary link is clicked', async () => {
	window.require = jest.fn().mockReturnValue(() => {});
	const user = userEvent.setup();
	const handleOpenLink = jest.fn();
	const { component, getByText } = render(DictionaryContent, {
		word: TEST_WORD
	});
	component.$on('link', handleOpenLink);
	await user.click(getByText('MWA'));
	expect(handleOpenLink).toHaveBeenCalled();
});
