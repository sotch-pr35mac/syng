import { fireEvent, render } from '@testing-library/svelte';
import { vi } from 'vitest';
import SyPopover from '@/components/SyPopover/SyPopover.svelte';

vi.mock('@tauri-apps/plugin-os', () => ({
	platform: vi.fn(() => 'ios'),
}));

it('should render mobile popovers through the snap sheet with a close action', async () => {
	const onclose = vi.fn();
	const { container, getByLabelText, getByText } = render(SyPopover, {
		props: {
			visible: true,
			mobileTitle: 'Reader settings',
			onclose,
		},
	});

	expect(container.querySelector('.sy-snap-sheet')).not.toBeNull();
	expect(getByText('Reader settings')).not.toBeNull();

	await fireEvent.click(getByLabelText('Close'));

	expect(onclose).toHaveBeenCalled();
});
