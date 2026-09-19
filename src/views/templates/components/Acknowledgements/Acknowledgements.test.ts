import { beforeEach, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { invoke } from '@tauri-apps/api/core';
import { openUrl } from '@tauri-apps/plugin-opener';
import Acknowledgements from '@/components/Acknowledgements/Acknowledgements.svelte';

const WIKTIONARY_ATTRIBUTION_URL =
	'https://github.com/sotch-pr35mac/chinese_dictionary/releases/download/v4.1.0/wiktionary-attribution-4.1.0.json';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

vi.mock('@tauri-apps/plugin-opener', () => ({
	openUrl: vi.fn(() => Promise.resolve()),
}));

vi.mock('@/utils/error.js', () => ({ handleError: vi.fn() }));

beforeEach(() => {
	vi.mocked(invoke).mockReset();
	vi.mocked(openUrl).mockClear();
	vi.mocked(invoke).mockResolvedValue([
		{
			name: 'Chinese dictionary sources and attribution',
			license: 'Source notices and manifest',
			text: 'Source notices',
		},
		{
			name: 'Wiktionary attribution',
			license: 'chinese_dictionary v4.1.0 — contributor attribution',
			text: '',
			url: WIKTIONARY_ATTRIBUTION_URL,
		},
	]);
});

it('opens the Wiktionary release artifact directly while keeping source notices expandable', async () => {
	const user = userEvent.setup();
	const acknowledgements = render(Acknowledgements);

	const attributionLink = await waitFor(() =>
		acknowledgements.getByRole('link', { name: /Wiktionary attribution/ })
	);
	expect(attributionLink.getAttribute('href')).toBe(WIKTIONARY_ATTRIBUTION_URL);
	await user.click(attributionLink);
	expect(openUrl).toHaveBeenCalledOnce();
	expect(openUrl).toHaveBeenCalledWith(WIKTIONARY_ATTRIBUTION_URL);

	const acknowledgementHeader = await waitFor(() =>
		acknowledgements.getByRole('button', {
			name: /Chinese dictionary sources and attribution/,
		})
	);
	await user.click(acknowledgementHeader);
	expect(acknowledgements.getByText('Source notices')).toBeTruthy();
});
