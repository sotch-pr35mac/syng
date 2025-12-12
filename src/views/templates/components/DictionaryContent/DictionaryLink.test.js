/* eslint-disable no-undef */
import { vi } from 'vitest';
import { fireEvent, render } from '@testing-library/svelte';
import DictionaryLink from './DictionaryLink.svelte';

it('should be styled like a link', async () => {
	const { getByTestId } = render(DictionaryLink, {
		link: 'A'
	});

	const link = getByTestId('dictionary-link');
	const linkStyles = link.className.split(' ');
	expect(linkStyles).toContain('dictionary-link');
});

it('should dispatch an event when the link is clicked', async () => {
	const mock = vi.fn();
	const { getByTestId } = render(DictionaryLink, {
		link: 'A',
		onopen: mock
	});

	const link = getByTestId('dictionary-link');
	await fireEvent.click(link);
	expect(mock).toHaveBeenCalled();
});