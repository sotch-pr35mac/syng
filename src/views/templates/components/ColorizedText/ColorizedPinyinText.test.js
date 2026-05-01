import { expect } from 'vitest';
import { render } from '@testing-library/svelte';
import ColorizedPinyinText from '@/components/ColorizedText/ColorizedPinyinText.svelte';

it('colors numbered pinyin by tone while preserving input text', () => {
	const { getByText } = render(ColorizedPinyinText, { text: 'ni3 hao3 ma5' });

	expect(getByText('ni3').className.split(' ')).toContain('colored-pinyin--tone-3');
	expect(getByText('hao3').className.split(' ')).toContain('colored-pinyin--tone-3');
	expect(getByText('ma5').className.split(' ')).toContain('colored-pinyin--tone-5');
});

it('colors marked pinyin by tone', () => {
	const { getByText } = render(ColorizedPinyinText, { text: 'nǐ hǎo' });

	expect(getByText('nǐ').className.split(' ')).toContain('colored-pinyin--tone-3');
	expect(getByText('hǎo').className.split(' ')).toContain('colored-pinyin--tone-3');
});
