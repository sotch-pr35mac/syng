import { render } from '@testing-library/svelte';
import ColorizedPinyin from '@/components/ColorizedText/ColorizedPinyin.svelte';

const THIRD_TONE = 3;

const wordData = {
	traditional: '你好',
	simplified: '你好',
	pinyin_marks: 'nǐ hǎo',
	pinyin_numbers: 'ni3 hao3',
	tone_marks: [THIRD_TONE, THIRD_TONE],
	english: ['hello'],
	hash: 1,
	hsk: 1,
	word_id: 1,
};

it('renders pinyin syllables with tone classes', () => {
	const { getByText } = render(ColorizedPinyin, {
		segments: [{ source: '你好', word_data: wordData }],
	});

	expect(getByText('nǐ').className.split(' ')).toContain('colored-pinyin--tone-3');
	expect(getByText('hǎo').className.split(' ')).toContain('colored-pinyin--tone-3');
});

it('renders non-dictionary segments without tone classes', () => {
	const { getByText } = render(ColorizedPinyin, {
		segments: [{ source: 'Hello!', word_data: null }],
	});

	expect(getByText('Hello!').className).not.toContain('colored-pinyin--tone');
});

it('handles multi-character words as multiple syllables', () => {
	const { container, getByText } = render(ColorizedPinyin, {
		segments: [{ source: '你好', word_data: wordData }],
	});

	expect(container.textContent.trim()).toBe('nǐ hǎo');
	expect(getByText('nǐ')).toBeTruthy();
	expect(getByText('hǎo')).toBeTruthy();
});
