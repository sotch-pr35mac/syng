import { beforeEach, expect, it, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { openUrl } from '@tauri-apps/plugin-opener';
import RegionSelector from '@/components/Onboarding/RegionSelector.svelte';

vi.mock('@tauri-apps/plugin-opener', () => ({
	openUrl: vi.fn(() => Promise.resolve()),
}));

beforeEach(() => {
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
	expect(select.tagName).toBe('SELECT');
	const cldrLink = getByRole('link', { name: 'Unicode CLDR' }) as HTMLAnchorElement;
	expect(cldrLink.href).toBe('https://cldr.unicode.org/');
	await user.click(cldrLink);
	expect(openUrl).toHaveBeenCalledWith('https://cldr.unicode.org/');

	await user.selectOptions(select, 'US');
	expect(onselect).toHaveBeenCalledWith('US');
	unmount();

	const selected = render(RegionSelector, {
		props: { selectedRegionCode: 'JP', onselect },
	});
	expect(selected.getByText('Selected: Japan')).toBeTruthy();
	expect((selected.getByLabelText('Country or region') as HTMLSelectElement).value).toBe('JP');
});
