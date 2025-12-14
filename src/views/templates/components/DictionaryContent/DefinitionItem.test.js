 
import { vi } from 'vitest';
import { render } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import DefinitionItem from './DefinitionItem.svelte';

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
	const user = userEvent.setup();
	const handleOpenLink = vi.fn();
	const { getByText } = render(DefinitionItem, {
		value: 'numeral 9 in Suzhou numeral system 蘇州碼子|苏州码子[Su1 zhou1 ma3 zi5]',
		onevent: handleOpenLink
	});
	const link = getByText('苏州码子 ( 蘇州碼子)');
	await user.click(link);
	expect(handleOpenLink).toHaveBeenCalled();
});