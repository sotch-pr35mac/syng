import { render } from '@testing-library/svelte';
import ColorizedPinyinSyllables from '@/components/ColorizedText/ColorizedPinyinSyllables.svelte';

it('colors each syllable while preserving the original whitespace', () => {
	const { container, getByText } = render(ColorizedPinyinSyllables, {
		pinyin: 'shí  yàn',
		tones: [2, 4],
	});

	expect(container.textContent).toBe('shí  yàn');
	expect(getByText('shí').className.split(' ')).toContain('colored-pinyin--tone-2');
	expect(getByText('yàn').className.split(' ')).toContain('colored-pinyin--tone-4');
});

it('renders neutral selectable syllables when coloring is disabled', () => {
	const { getByText } = render(ColorizedPinyinSyllables, {
		pinyin: 'shí yàn',
		tones: [2, 4],
		colorByTone: false,
	});

	expect(getByText('shí').className.split(' ')).toContain('sy-text--selectable');
	expect(getByText('shí').className).not.toContain('colored-pinyin--tone');
	expect(getByText('yàn').className).not.toContain('colored-pinyin--tone');
});
