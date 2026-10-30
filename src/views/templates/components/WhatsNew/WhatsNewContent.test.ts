import { expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import WhatsNewContent from '@/components/WhatsNew/WhatsNewContent.svelte';
import { whatsNewStore } from '@/stores/whatsNew.svelte.js';

const opener = vi.hoisted(() => ({ openUrl: vi.fn(async () => {}) }));
vi.mock('@tauri-apps/plugin-opener', () => opener);

vi.mock('@/stores/whatsNew.svelte.js', () => ({
	whatsNewStore: {
		range: { from: '2.4.0', to: '2.6.0' },
		platform: 'desktop',
		expanded: false,
		markPresented: vi.fn(),
		disclose: vi.fn(),
		action: vi.fn(),
	},
}));

vi.mock('@/components/WhatsNew/whatsNewContent.js', () => ({
	releaseContent: ['2.4.0', '2.5.0', '2.6.0'].map((version) => ({
		version,
		date: '2026-10-20',
		announce: true,
		highlights: [
			{
				title: `Highlight ${version}`,
				body: `Description ${version}`,
				credit: `Credit ${version}`,
			},
		],
		feedback: {
			prompt: `Feedback prompt ${version}.`,
			email: 'hello@bytecraft.xyz',
			outcome: 'Feedback outcome.',
			subject: 'Syng Feature Request',
		},
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
	expect(getByText('Credit 2.6.0')).toBeTruthy();
	expect(getByText('Highlight 2.5.0').closest('details')?.open).toBe(false);
	expect(getByText('Highlight 2.4.0').closest('details')?.open).toBe(false);
	expect(queryByText('Feedback prompt 2.5.0.')).toBeNull();
	expect(queryByText('Improvement 2.6.0')).toBeNull();
	const feedback = getByRole('link', { name: 'hello@bytecraft.xyz' });
	expect(feedback.getAttribute('href')).toBe(
		'mailto:hello@bytecraft.xyz?subject=Syng%20Feature%20Request'
	);
	await user.click(feedback);
	expect(opener.openUrl).toHaveBeenCalledExactlyOnceWith(
		'mailto:hello@bytecraft.xyz?subject=Syng%20Feature%20Request'
	);

	await user.click(getByRole('button', { name: 'Other improvements' }));
	expect(getByText('Improvement 2.6.0')).toBeTruthy();
	expect(getByText('Improvement 2.5.0').closest('details')?.open).toBe(false);

	await user.click(getByText('Also new since your last version'));
	await waitFor(() => expect(whatsNewStore.disclose).toHaveBeenCalledWith('cumulative', true));
	expect(getByRole('heading', { name: 'Syng 2.5.0' })).toBeTruthy();
	expect(getByText('Improvement 2.5.0').closest('details')?.open).toBe(true);
	expect(getByText('Highlight 2.4.0').closest('details')?.open).toBe(false);

	await user.click(getByText('Earlier releases'));
	await waitFor(() => expect(whatsNewStore.disclose).toHaveBeenCalledWith('earlier', true));
	expect(getByRole('heading', { name: 'Syng 2.4.0' })).toBeTruthy();
});
