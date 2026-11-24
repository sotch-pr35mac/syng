import { render, waitFor } from '@testing-library/svelte';
import { expect, it } from 'vitest';
import SyTab from '@/components/SyTab/SyTab.svelte';

it('exposes tab selection and panel association when used as a tab', async () => {
	const { getByRole, rerender } = render(SyTab, {
		role: 'tab',
		id: 'general-tab',
		'aria-label': 'General',
		'aria-controls': 'general-panel',
		active: true,
	});
	const tab = getByRole('tab', { name: 'General', selected: true });

	expect(tab.getAttribute('aria-controls')).toBe('general-panel');
	expect(tab.tabIndex).toBe(0);
	expect(tab.getAttribute('type')).toBe('button');
	await rerender({ active: false });
	expect(tab.getAttribute('aria-selected')).toBe('false');
	expect(tab.tabIndex).toBe(-1);
});

it('keeps ordinary button consumers compatible until their tablist is migrated', () => {
	const { getByRole } = render(SyTab, { 'aria-label': 'Tools', active: false });
	const button = getByRole('button', { name: 'Tools' });

	expect(button.tabIndex).toBe(0);
	expect(button.hasAttribute('aria-selected')).toBe(false);
});

it('keeps a mobile tab usable when text range geometry is unavailable', async () => {
	const { container, getByRole } = render(SyTab, {
		variant: 'mobile',
		role: 'tab',
		'aria-label': 'Convert',
		active: true,
	});
	await waitFor(() =>
		expect(container.querySelector('.sy-tab__indicator')?.getAttribute('style')).toContain(
			'opacity: 1'
		)
	);
	expect(getByRole('tab', { name: 'Convert', selected: true }).getAttribute('tabindex')).toBe(
		'0'
	);
});
