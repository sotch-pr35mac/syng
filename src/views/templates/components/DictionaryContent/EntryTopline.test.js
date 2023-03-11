/* eslint-disable no-undef */
import EntryTopline from './EntryTopline.svelte';
import { render } from '@testing-library/svelte';

const TEST_WORD_1 = {
	simplified: 'AB',
	traditional: 'CD',
	tone_marks: [1, 2],
	pinyin_marks: 'ac1 bd2'
};
const TEST_WORD_2 = {
	simplified: 'AB',
	traditional: 'AB',
	tone_marks: [1, 2],
	pinyin_marks: 'a1 b2'
};

it('should properly display pinyin', async () => {
	const { getByText } = render(EntryTopline, {
		word: TEST_WORD_2
	});

	const pinyin = getByText('a1 b2');
	const pinyinClasses = pinyin.className.split(' ');
	expect(pinyinClasses).toContain('chinese-characters--pinyin-container');
});

it('should include the correct classes', async () => {
	const { getByTestId } = render(EntryTopline, {
		word: TEST_WORD_1
	});

	const chineseCharactersClasses = getByTestId('chinese-characters').className.split(' ');
	expect(chineseCharactersClasses).toContain('chinese-characters--character-container');
	expect(chineseCharactersClasses).toContain('chinese-characters--character');
});

it('should display simplified and traditional characters separately', async () => {
	const { getByTestId } = render(EntryTopline, {
		word: TEST_WORD_1
	});

	const chineseCharacters = getByTestId('chinese-characters');
	expect(chineseCharacters.textContent).toBe('AB \xa0(CD)');
});

it('should omit displaying traditional characters if they match the simplified', async () => {
	const { getByTestId } = render(EntryTopline, {
		word: TEST_WORD_2
	});

	const chineseCharacters = getByTestId('chinese-characters');
	expect(chineseCharacters.textContent.trim()).toBe('AB');	
});