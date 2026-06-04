import { expect } from 'vitest';
import { render } from '@testing-library/svelte';
import ColorizedRawPinyinText from '@/components/ColorizedText/ColorizedRawPinyinText.svelte';

it('colors numbered pinyin by tone while preserving input text', () => {
	const { getByText } = render(ColorizedRawPinyinText, {
		tokens: [
			{ text: 'ni3', tone: 3 },
			{ text: ' ', tone: null },
			{ text: 'hao3', tone: 3 },
			{ text: ' ', tone: null },
			{ text: 'ma5', tone: 5 },
		],
	});

	expect(getByText('ni3').className.split(' ')).toContain('colored-pinyin--tone-3');
	expect(getByText('hao3').className.split(' ')).toContain('colored-pinyin--tone-3');
	expect(getByText('ma5').className.split(' ')).toContain('colored-pinyin--tone-5');
});

it('colors marked pinyin by tone', () => {
	const { getByText } = render(ColorizedRawPinyinText, {
		tokens: [
			{ text: 'nǐ', tone: 3 },
			{ text: ' ', tone: null },
			{ text: 'hǎo', tone: 3 },
		],
	});

	expect(getByText('nǐ').className.split(' ')).toContain('colored-pinyin--tone-3');
	expect(getByText('hǎo').className.split(' ')).toContain('colored-pinyin--tone-3');
});
