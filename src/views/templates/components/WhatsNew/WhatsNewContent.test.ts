import { expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import WhatsNewContent from '@/components/WhatsNew/WhatsNewContent.svelte';
import { whatsNewStore } from '@/stores/whatsNew.svelte.js';

vi.mock('@/stores/whatsNew.svelte.js', () => ({
	whatsNewStore: {
		range: { from: '2.4.0', to: '2.6.0' },
		platform: 'desktop',
		expanded: false,
		markPresented: vi.fn(),
	},
}));

vi.mock('@/components/WhatsNew/whatsNewContent.js', () => ({
	releaseContent: ['2.4.0', '2.5.0', '2.6.0'].map((version) => ({
		version,
		date: '2026-10-20',
		announce: true,
		highlights: [{ title: `Highlight ${version}`, body: `Description ${version}` }],
		improvements: [{ text: `Improvement ${version}` }],
	})),
}));

it('keeps the latest highlights visible and cumulative and older releases expandable', async () => {
	const user = userEvent.setup();
	const onready = vi.fn();
	const { getByRole, getByText, queryByText } = render(WhatsNewContent, { onready });

	await waitFor(() => expect(onready).toHaveBeenCalledOnce());
	expect(whatsNewStore.markPresented).toHaveBeenCalledOnce();
	expect(getByRole('heading', { name: 'Highlight 2.6.0' })).toBeTruthy();
	expect(getByText('Highlight 2.5.0').closest('details')?.open).toBe(false);
	expect(getByText('Highlight 2.4.0').closest('details')?.open).toBe(false);
	expect(queryByText('Improvement 2.6.0')).toBeNull();

	await user.click(getByRole('button', { name: 'Other improvements' }));
	expect(getByText('Improvement 2.6.0')).toBeTruthy();
	expect(getByText('Improvement 2.5.0').closest('details')?.open).toBe(false);

	await user.click(getByText('Also new since your last version'));
	expect(getByRole('heading', { name: 'Syng 2.5.0' })).toBeTruthy();
	expect(getByText('Improvement 2.5.0').closest('details')?.open).toBe(true);
	expect(getByText('Highlight 2.4.0').closest('details')?.open).toBe(false);

	await user.click(getByText('Earlier releases'));
	expect(getByRole('heading', { name: 'Syng 2.4.0' })).toBeTruthy();
});
