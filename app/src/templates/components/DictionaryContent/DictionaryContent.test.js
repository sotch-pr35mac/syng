/* eslint-disable no-undef */
import DictionaryContent from './DictionaryContent.svelte';
import { render } from '@testing-library/svelte';

const TEST_WORD = {
	simplified: 'A',
	traditional: 'B',
	english: ['test'],
	pinyinMarks: ['a1'],
	tonesMarks: [1]
};

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

	const pinyin = getByText(TEST_WORD.pinyinMarks[0]);

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
