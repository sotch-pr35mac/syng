/* eslint-disable no-undef */
import DefinitionItem from './DefinitionItem.svelte';
import { render } from '@testing-library/svelte';

it('should display textual value with the correct styles', async () => {
	const { getByText } = render(DefinitionItem, {
		value: 'test'
	});

	const text = getByText('test');
	const styles = text.className.split(' ');
	expect(text.textContent).toBe('test');
	expect(styles).toContain('dictionary-content--definition-item');
});
