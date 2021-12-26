/* eslint-disable no-undef */
import DefinitionItem from './DefinitionItem.svelte';
import { render } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { wait } from '../../../../test/utils/unitTestUtils.js';

it('should display textual value with the correct styles', async () => {
	const { getByText } = render(DefinitionItem, {
		value: 'test'
	});

	const text = getByText('test');
	const styles = text.className.split(' ');
	expect(text.textContent).toBe('test');
	expect(styles).toContain('dictionary-content--definition-item');
});

it('should handle links if a link is present in the text', async () => {
	const handleOpenLink = jest.fn();
	const { getByText } = render(DefinitionItem, {
		value: 'numeral 9 in Suzhou numeral system 蘇州碼子|苏州码子[Su1 zhou1 ma3 zi5]'
	});

	wait(() => {
		const link = getByText('numeral 9 in Suzhou numeral system 苏州码子 (蘇州碼子)');
		expect(link.textContent).toBe('numeral 9 in Suzhou numeral system 苏州码子 (蘇州碼子)');
		userEvent.click(link);
		expect(handleOpenLink).toHaveBeenCalled();
	});
});
