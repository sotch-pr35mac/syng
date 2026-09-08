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

it('leaves vertical tooltip positioning to the shared tooltip rules', async () => {
	const source = (await import('./SyTag.svelte?raw')).default;
	const localTooltipRule = source.match(/\.sy-tag \.sy-tooltip--body\s*\{([^}]*)\}/)?.[1] ?? '';

	expect(localTooltipRule).not.toMatch(/\btop\s*:/);
	expect(localTooltipRule).not.toMatch(/\bmargin(?:-top)?\s*:/);
	expect(localTooltipRule).not.toMatch(/\btransform\s*:/);
	expect(source).not.toMatch(/\.sy-tag \.sy-tooltip--body p[^}]*font-weight/s);
});
