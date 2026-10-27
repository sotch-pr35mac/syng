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

it('shows source-specific license text before opening an optional source link', async () => {
	const user = userEvent.setup();
	vi.mocked(invoke).mockResolvedValue([
		{
			name: 'Dong Chinese — character breakdown',
			license: 'Creative Commons Attribution-ShareAlike 4.0',
			text: 'Dong Chinese attribution and full CC BY-SA license',
			url: 'https://www.dong-chinese.com/wiki',
		},
		{
			name: 'Make Me a Hanzi — dictionary data',
			license: 'GNU Lesser General Public License v3.0 or later',
			text: 'Make Me a Hanzi attribution and full LGPL and GPL texts',
			url: 'https://github.com/skishore/makemeahanzi',
		},
	]);
	const view = render(Acknowledgements);
	await user.click(await view.findByRole('button', { name: /Dong Chinese/ }));
	expect(view.getByText('Dong Chinese attribution and full CC BY-SA license')).toBeTruthy();
	expect(openUrl).not.toHaveBeenCalled();
	await user.click(view.getByRole('link', { name: 'View source' }));
	expect(openUrl).toHaveBeenLastCalledWith('https://www.dong-chinese.com/wiki');
	await user.click(view.getByRole('button', { name: /Make Me a Hanzi/ }));
	expect(view.queryByText('Dong Chinese attribution and full CC BY-SA license')).toBeNull();
	expect(view.getByText('Make Me a Hanzi attribution and full LGPL and GPL texts')).toBeTruthy();
	await user.click(view.getByRole('link', { name: 'View source' }));
	expect(openUrl).toHaveBeenLastCalledWith('https://github.com/skishore/makemeahanzi');
});
