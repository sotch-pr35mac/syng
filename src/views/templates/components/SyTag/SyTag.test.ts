import { expect, it } from 'vitest';
import { render } from '@testing-library/svelte';
import SyTag from '@/components/SyTag/SyTag.svelte';

it('renders valid tag and tooltip markup', () => {
	const { container, getByText } = render(SyTag, {
		props: { tooltip: 'HSK level source' },
	});
	const tag = container.querySelector('.sy-tag');
	const tooltip = getByText('HSK level source');

	expect(tag?.tagName).toBe('SPAN');
	expect(tooltip.tagName).toBe('P');
	expect(tooltip.closest('.sy-tooltip--body-bottom')).toBeTruthy();
});
