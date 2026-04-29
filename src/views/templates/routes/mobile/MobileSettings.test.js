import { beforeEach, expect, vi } from 'vitest';
import { fireEvent, render, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import MobileSettings from '@/routes/mobile/MobileSettings.svelte';
import { settingsActiveTabStore } from '@/stores/settings.svelte.js';
import { telemetry } from '@/utils/telemetry.js';

vi.mock('@/utils/telemetry.js', () => ({
	telemetry: {
		getPrefs: vi.fn(() =>
			Promise.resolve({
				enabled: true,
				track_events: true,
				track_screen_views: true,
				track_errors: true,
				include_device_context: true,
			})
		),
		getQueuedEvents: vi.fn(() => Promise.resolve([])),
		setPref: vi.fn(() => Promise.resolve()),
		trackEvent: vi.fn(() => Promise.resolve()),
	},
}));

const toneColors = {
	hasCustomColors: false,
	colors: ['#3366ff', '#ffcc00', '#ff3333', '#33aa66', '#777777'],
};

beforeEach(() => {
	settingsActiveTabStore.set('general');
	window.preferenceManager = {
		get: vi.fn((name) => {
			if (name === 'toneColors') {
				return toneColors;
			}
			return undefined;
		}),
		set: vi.fn(),
	};
	vi.mocked(telemetry.getPrefs).mockClear();
	vi.mocked(telemetry.getQueuedEvents).mockClear();
	vi.mocked(telemetry.setPref).mockClear();
	vi.mocked(telemetry.trackEvent).mockClear();
});

it('renders the mobile general settings without desktop-only options', () => {
	const { getByText, queryByRole, queryByText } = render(MobileSettings);

	expect(queryByRole('heading', { name: 'Settings' })).toBeNull();
	expect(getByText('Tone Colors')).toBeTruthy();
	expect(queryByText('Updates')).toBeNull();
	expect(queryByText('Under Construction Features')).toBeNull();
});

it('updates tone colors through the shared settings handler', async () => {
	const { getByLabelText } = render(MobileSettings);
	const firstTone = getByLabelText('First Tone');

	await fireEvent.change(firstTone, { target: { value: '#111111' } });

	expect(window.preferenceManager.set).toHaveBeenCalledWith('toneColors', {
		hasCustomColors: true,
		colors: ['#111111', '#ffcc00', '#ff3333', '#33aa66', '#777777'],
	});
	expect(telemetry.trackEvent).toHaveBeenCalledWith('settings.changed', {
		setting: 'toneColors',
	});
});

it('shows every telemetry option on the telemetry tab', async () => {
	const user = userEvent.setup();
	const { getByText } = render(MobileSettings);

	await user.click(getByText('Telemetry'));

	await waitFor(() => expect(getByText('Enable Telemetry')).toBeTruthy());
	expect(getByText('Event Tracking')).toBeTruthy();
	expect(getByText('Screen Views')).toBeTruthy();
	expect(getByText('Error Reporting')).toBeTruthy();
	expect(getByText('Device Context')).toBeTruthy();
	expect(getByText('Recent Telemetry Events')).toBeTruthy();
});

it('restores the last active settings tab', async () => {
	settingsActiveTabStore.set('telemetry');
	const { getByText } = render(MobileSettings);

	await waitFor(() => expect(getByText('Enable Telemetry')).toBeTruthy());
});
