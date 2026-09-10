import { beforeEach, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { invoke } from '@tauri-apps/api/core';
import { openUrl } from '@tauri-apps/plugin-opener';
import RegionSelector from '@/components/Onboarding/RegionSelector.svelte';
import { resetRegionOptionsForTest } from '@/utils/regions.js';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

vi.mock('@tauri-apps/plugin-opener', () => ({
	openUrl: vi.fn(() => Promise.resolve()),
}));

beforeEach(() => {
	resetRegionOptionsForTest();
	vi.mocked(invoke).mockResolvedValue([
		{ code: 'US', fallbackName: 'United States of America' },
		{ code: 'JP', fallbackName: 'Japan' },
	]);
	vi.mocked(openUrl).mockClear();
});

it('uses a country select and reports the selected alpha-2 code', async () => {
	const user = userEvent.setup();
	const onselect = vi.fn();
	const { getByLabelText, getByRole, queryByText, unmount } = render(RegionSelector, {
		props: { onselect },
	});

	expect(queryByText('Start typing to find your country.')).toBeNull();
	const select = getByLabelText('Country or region') as HTMLSelectElement;
	await waitFor(() => expect(select.disabled).toBe(false));
	expect(select.tagName).toBe('SELECT');
	const isoLink = getByRole('link', { name: 'ISO 3166' }) as HTMLAnchorElement;
	expect(isoLink.href).toBe('https://www.iso.org/iso-3166-country-codes.html');
	await user.click(isoLink);
	expect(openUrl).toHaveBeenCalledWith('https://www.iso.org/iso-3166-country-codes.html');

	await user.selectOptions(select, 'US');
	expect(onselect).toHaveBeenCalledWith('US');
	unmount();

	const selected = render(RegionSelector, {
		props: { selectedRegionCode: 'JP', onselect },
	});
	await waitFor(() =>
		expect((selected.getByLabelText('Country or region') as HTMLSelectElement).value).toBe('JP')
	);
	expect(selected.queryByText('Selected: Japan')).toBeNull();
});
