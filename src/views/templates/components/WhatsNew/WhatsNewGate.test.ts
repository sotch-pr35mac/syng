import { beforeEach, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import WhatsNewGate from '@/components/WhatsNew/WhatsNewGate.svelte';

const openPending = vi.hoisted(() => vi.fn());
vi.mock('@/stores/whatsNew.svelte.js', () => ({ whatsNewStore: { openPending } }));
const children = createRawSnippet(() => ({ render: () => '<p>Workspace ready</p>' }));

beforeEach(() => {
	openPending.mockReset().mockResolvedValue(undefined);
});

it('holds routed content until startup and recovery finish and navigation resolves', async () => {
	let finish!: () => void;
	openPending.mockImplementation(
		() =>
			new Promise<void>((resolve) => {
				finish = resolve;
			})
	);
	const view = render(WhatsNewGate, { ready: false, blocked: true, children });
	expect(view.queryByText('Workspace ready')).toBeNull();
	await view.rerender({ ready: true, blocked: true, children });
	expect(openPending).not.toHaveBeenCalled();
	await view.rerender({ ready: true, blocked: false, children });
	await waitFor(() => expect(openPending).toHaveBeenCalledOnce());
	expect(view.queryByText('Workspace ready')).toBeNull();
	finish();
	await waitFor(() => expect(view.getByText('Workspace ready')).toBeTruthy());
});

it('continues to the app if automatic navigation fails', async () => {
	openPending.mockRejectedValueOnce(new Error('navigation failed'));
	const view = render(WhatsNewGate, { ready: true, blocked: false, children });
	await waitFor(() => expect(view.getByText('Workspace ready')).toBeTruthy());
});
