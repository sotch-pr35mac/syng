import { beforeEach, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import OnboardingFlow from '@/components/Onboarding/OnboardingFlow.svelte';
import { dictionaryDisplaySettingsStore } from '@/stores/dictionaryDisplaySettings.svelte.js';
import { onboardingStore } from '@/stores/onboarding.svelte.js';
import { privacySettingsStore } from '@/stores/privacySettings.svelte.js';
import { setPreferenceManagerForTest } from '@/utils/appServices.js';
import { telemetry } from '@/utils/telemetry.js';

vi.mock('lucide-svelte', async () => {
	const mockIcon = (await import('@/components/__mocks__/FeatherIcon.svelte')).default;
	return {
		Award: mockIcon,
		Bookmark: mockIcon,
		BookOpen: mockIcon,
		GraduationCap: mockIcon,
		Search: mockIcon,
		SquareStack: mockIcon,
	};
});

const telemetryState = vi.hoisted(() => ({
	enabled: true,
	track_events: true,
	track_screen_views: true,
	track_errors: true,
	include_device_context: true,
}));

vi.mock('@/utils/telemetry.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('@/utils/telemetry.js')>();
	return {
		...actual,
		telemetry: {
			trackEvent: vi.fn(() => Promise.resolve()),
			getPrefs: vi.fn(() => Promise.resolve({ ...telemetryState })),
			setPref: vi.fn((key: string, value: boolean) => {
				telemetryState[key as keyof typeof telemetryState] = value;
				return Promise.resolve();
			}),
		},
	};
});

vi.mock('@/utils/error.js', () => ({
	handleError: vi.fn(),
}));

const preferences: Record<string, unknown> = {};
let preferenceManager: {
	waitForInit: ReturnType<typeof vi.fn>;
	get: ReturnType<typeof vi.fn>;
	set: ReturnType<typeof vi.fn>;
};

beforeEach(async () => {
	telemetryState.enabled = true;
	telemetryState.track_events = true;
	telemetryState.track_screen_views = true;
	telemetryState.track_errors = true;
	telemetryState.include_device_context = true;
	Object.keys(preferences).forEach((key) => {
		delete preferences[key];
	});
	Object.assign(preferences, {
		characterSet: 'both',
		colorCharactersByTone: true,
		colorPinyinByTone: false,
		colorListsByTone: false,
		regionCode: null,
		childPrivacyMode: false,
		completedOnboardingVersion: 0,
	});
	preferenceManager = {
		waitForInit: vi.fn(() => Promise.resolve()),
		get: vi.fn((name: string) => preferences[name]),
		set: vi.fn((name: string, value: unknown) => {
			preferences[name] = value;
		}),
	};
	setPreferenceManagerForTest(preferenceManager as never);
	await dictionaryDisplaySettingsStore.loadSettings();
	privacySettingsStore.setPrivacySettingsForTest({
		regionCode: null,
		childPrivacyMode: false,
		completedOnboardingVersion: 0,
	});
	onboardingStore.reset();
	vi.mocked(telemetry.trackEvent).mockClear();
	vi.mocked(telemetry.setPref).mockClear();
	window.location.hash = '';
	window.matchMedia = vi.fn().mockImplementation(() => ({
		matches: false,
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
	}));
	Element.prototype.animate = vi.fn().mockReturnValue({
		finished: Promise.resolve(),
		cancel: vi.fn(),
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
	});
});

async function continueFromWelcome(user: ReturnType<typeof userEvent.setup>) {
	const view = render(OnboardingFlow);
	const { getByRole, getByText, queryByRole, container } = view;

	expect(getByText('Welcome to Syng')).toBeTruthy();
	expect(
		getByText(/Syng helps you understand the Chinese you encounter and learn from it/i)
	).toBeTruthy();
	expect(
		getByText(/Look up words and phrases with characters, pinyin, and English/)
	).toBeTruthy();
	expect(getByText('Review')).toBeTruthy();
	expect(getByText('And More')).toBeTruthy();
	expect(queryByRole('heading', { name: 'Syng' })).toBeNull();
	expect(queryByRole('button', { name: 'Back' })).toBeNull();
	expect(queryByRole('button', { name: /skip/i })).toBeNull();
	expect(container.querySelector('.onboarding-flow--desktop')).toBeTruthy();
	expect(container.querySelector('.welcome-step__features')).toBeTruthy();
	expect(container.querySelector('.onboarding-flow__actions .onboarding-progress')).toBeTruthy();

	await user.click(getByRole('button', { name: 'Continue' }));
	await waitFor(() => expect(getByText('Chinese display')).toBeTruthy());
	return view;
}

it('walks Welcome → Preferences → Privacy → complete and persists version 1', async () => {
	const user = userEvent.setup();
	const { getByRole, getByText, queryByLabelText, getByLabelText } =
		await continueFromWelcome(user);

	expect(queryByLabelText('First Tone')).toBeNull();
	expect(getByLabelText('Apply tone coloring to lists')).toBeTruthy();
	expect(getByText('List result')).toBeTruthy();
	const characterRadios = document.querySelectorAll('input[name="character-set"]');
	expect((characterRadios[0] as HTMLInputElement).value).toBe('both');

	await user.click(getByRole('radio', { name: 'Traditional' }));
	await user.click(getByRole('button', { name: 'Continue' }));
	await waitFor(() => expect(getByText('Privacy')).toBeTruthy());

	expect((getByRole('button', { name: 'Get Started' }) as HTMLButtonElement).disabled).toBe(true);
	await user.click(getByRole('button', { name: 'Back' }));
	await waitFor(() =>
		expect((getByRole('radio', { name: 'Traditional' }) as HTMLInputElement).checked).toBe(true)
	);

	await user.click(getByRole('button', { name: 'Continue' }));
	await waitFor(() => expect(getByText('Country or region')).toBeTruthy());

	await user.selectOptions(getByLabelText('Country or region'), 'US');
	await waitFor(() =>
		expect(getByText('Are you below the age of 13 for this region?')).toBeTruthy()
	);
	expect((getByRole('button', { name: 'Get Started' }) as HTMLButtonElement).disabled).toBe(true);

	await user.click(getByRole('button', { name: 'No' }));
	await waitFor(() => expect(getByLabelText('Enable Telemetry')).toBeTruthy());
	expect(getByRole('button', { name: 'No' }).getAttribute('aria-pressed')).toBe('true');
	expect(getByLabelText('Event Tracking')).toBeTruthy();
	expect(getByLabelText('Screen Views')).toBeTruthy();
	expect(getByLabelText('Error Reporting')).toBeTruthy();
	expect(getByLabelText('Device Context')).toBeTruthy();
	expect(getByText('Example payloads')).toBeTruthy();
	expect(getByText(/onboarding.step_viewed/)).toBeTruthy();
	expect((getByRole('button', { name: 'Get Started' }) as HTMLButtonElement).disabled).toBe(
		false
	);

	await user.click(getByRole('button', { name: 'Get Started' }));

	expect(preferenceManager.set).toHaveBeenCalledWith('completedOnboardingVersion', 1);
	expect(telemetry.trackEvent).toHaveBeenCalledWith('onboarding.started', {});
	expect(telemetry.trackEvent).toHaveBeenCalledWith('onboarding.step_viewed', {
		step: 'welcome',
	});
	expect(telemetry.trackEvent).toHaveBeenCalledWith('onboarding.step_viewed', {
		step: 'chinese_preferences',
	});
	expect(telemetry.trackEvent).toHaveBeenCalledWith('onboarding.step_viewed', {
		step: 'privacy',
	});
	expect(telemetry.trackEvent).toHaveBeenCalledWith('onboarding.completed', {
		child_privacy_mode: false,
	});
	expect(window.location.hash).toBe('#/');
}, 15000);

it('progressively discloses privacy controls and locks telemetry in child mode', async () => {
	const user = userEvent.setup();
	const { getByRole, getByText, getByLabelText, queryByLabelText, queryByText } =
		await continueFromWelcome(user);

	await user.click(getByRole('button', { name: 'Continue' }));
	await waitFor(() => expect(getByText('Privacy')).toBeTruthy());

	expect(queryByLabelText('Enable Telemetry')).toBeNull();
	expect(queryByText('Are you below the age of 13 for this region?')).toBeNull();

	await user.selectOptions(getByLabelText('Country or region'), 'US');
	await waitFor(() =>
		expect(getByText('Are you below the age of 13 for this region?')).toBeTruthy()
	);
	expect(queryByLabelText('Enable Telemetry')).toBeNull();

	await user.click(getByRole('button', { name: 'Yes' }));
	await waitFor(() => expect(getByLabelText('Enable Telemetry')).toBeTruthy());
	expect((getByLabelText('Enable Telemetry') as HTMLInputElement).disabled).toBe(true);
	expect((getByLabelText('Enable Telemetry') as HTMLInputElement).checked).toBe(false);
	expect(queryByLabelText('Event Tracking')).toBeNull();
	expect(getByText('No telemetry is sent with these settings.')).toBeTruthy();
	expect(telemetry.setPref).toHaveBeenCalledWith('enabled', false);
	expect(
		getByText('Telemetry is turned off while additional privacy protections apply.')
	).toBeTruthy();

	await user.click(getByRole('button', { name: 'Get Started' }));
	expect(preferenceManager.set).toHaveBeenCalledWith('childPrivacyMode', true);
	expect(telemetry.trackEvent).not.toHaveBeenCalledWith(
		'onboarding.completed',
		expect.anything()
	);
});

it('skips the age question for other regions and allows disabling telemetry', async () => {
	const user = userEvent.setup();
	const { getByRole, getByText, getByLabelText, queryByText } = await continueFromWelcome(user);

	await user.click(getByRole('button', { name: 'Continue' }));
	await waitFor(() => expect(getByText('Privacy')).toBeTruthy());

	await user.selectOptions(getByLabelText('Country or region'), 'CN');
	await waitFor(() => expect(getByLabelText('Enable Telemetry')).toBeTruthy());
	expect(queryByText('Are you below the age of 13 for this region?')).toBeNull();
	expect((getByLabelText('Enable Telemetry') as HTMLInputElement).checked).toBe(true);
	expect((getByLabelText('Enable Telemetry') as HTMLInputElement).disabled).toBe(false);

	await user.click(getByLabelText('Device Context'));
	expect(telemetry.setPref).toHaveBeenCalledWith('include_device_context', false);
	expect(getByText(/onboarding.step_viewed/)).toBeTruthy();
	expect(getByText(/"family": "event"/)).toBeTruthy();
	expect(queryByText(/"device_context"/)).toBeNull();

	await user.click(getByLabelText('Event Tracking'));
	expect(telemetry.setPref).toHaveBeenCalledWith('track_events', false);
	expect(queryByText(/"family": "event"/)).toBeNull();
	expect(getByText(/"family": "screen_view"/)).toBeTruthy();

	await user.click(getByLabelText('Enable Telemetry'));
	expect(telemetry.setPref).toHaveBeenCalledWith('enabled', false);
	await waitFor(() =>
		expect(getByText('No telemetry is sent with these settings.')).toBeTruthy()
	);

	await user.click(getByRole('button', { name: 'Get Started' }));
	expect(telemetry.trackEvent).not.toHaveBeenCalledWith(
		'onboarding.completed',
		expect.anything()
	);
});

it('uses mobile layout classes when requested', () => {
	const { container } = render(OnboardingFlow, { props: { variant: 'mobile' } });
	expect(container.querySelector('.onboarding-flow--mobile')).toBeTruthy();
	expect(container.querySelector('.onboarding-flow--desktop')).toBeNull();
});
