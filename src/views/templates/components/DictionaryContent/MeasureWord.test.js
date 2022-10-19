/* eslint-disable no-undef */
import MeasureWord from './MeasureWord.svelte';
import { render } from '@testing-library/svelte';

const mockMeasureWordA = {
	simplified: 'A',
	traditional: 'A'
};

const mockMeasureWordB = {
	simplified: 'A',
	traditional: 'B'
};

it('should display a dictionary link', async () => {
	const { getByText } = render(MeasureWord, {
		value: mockMeasureWordA 
	});

	const text = getByText(mockMeasureWordA.traditional);
	const styles = text.className.split(' ');
	expect(styles).toContain('dictionary-link');
});

it('should display a single character when the traditional and simplified match', async () => {
	const { getByText } = render(MeasureWord, {
		value: mockMeasureWordA
	});

	const text = getByText(mockMeasureWordA.traditional);
	expect(text.textContent).toBe('A ');
});

it('should display both traditional and simplified when they do not match', async () => {
	const { getByText } = render(MeasureWord, {
		value: mockMeasureWordB
	});

	const text = getByText(`${mockMeasureWordB.simplified} (${mockMeasureWordB.traditional})`);
	expect(text.textContent).toBe('A  (B)');
});
