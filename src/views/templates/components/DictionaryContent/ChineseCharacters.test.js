/* eslint-disable no-undef */
import { render } from '@testing-library/svelte';
import ChineseCharacters from './ChineseCharacters.svelte';

it('should render the correct color for each character', async () => {
	const { getByText } = render(ChineseCharacters, {
		characters: '妈痲吗蚂么',
		tones: [1, 2, 3, 4, 5]
	});

	const firstTone = getByText('妈').className.split(' ');
	const secondTone = getByText('痲').className.split(' ');
	const thirdTone = getByText('吗').className.split(' ');
	const fourthTone = getByText('蚂').className.split(' ');
	const noTone = getByText('么').className.split(' ');

	expect(firstTone).toContain('colored-characters--tone-1');
	expect(secondTone).toContain('colored-characters--tone-2');
	expect(thirdTone).toContain('colored-characters--tone-3');
	expect(fourthTone).toContain('colored-characters--tone-4');
	expect(noTone).toContain('colored-characters--tone-5');
});