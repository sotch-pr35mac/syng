import { beforeEach, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import OnboardingFlow from '@/components/Onboarding/OnboardingFlow.svelte';
import { dictionaryDisplaySettingsStore } from '@/stores/dictionaryDisplaySettings.svelte.js';
import { onboardingStore } from '@/stores/onboarding.svelte.js';
import { privacySettingsStore } from '@/stores/privacySettings.svelte.js';
import { setPreferenceManagerForTest } from '@/utils/appServices.js';
import { telemetry } from '@/utils/telemetry.js';
import { submitInterviewSignup, INTERVIEW_CONSENT } from '@/utils/interviews.js';

vi.mock('@tauri-apps/api/core', () => ({
	invoke: vi.fn(() =>
		Promise.resolve([
			{ code: 'US', fallbackName: 'United States of America' },
			{ code: 'CN', fallbackName: 'China' },
		])
	),
}));

vi.mock('@/utils/interviews.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('@/utils/interviews.js')>();
	return { ...actual, submitInterviewSignup: vi.fn(() => Promise.resolve()) };
});

vi.mock('lucide-svelte', async () => {
	const mockIcon = (await import('@/components/__mocks__/FeatherIcon.svelte')).default;
	return {
		Award: mockIcon,
		BookOpen: mockIcon,
		GraduationCap: mockIcon,
		Search: mockIcon,
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
		hskVariant: 'hsk_exam_syllabus_2025',
		showQualifiers: true,
		showPartsOfSpeech: true,
		showAlternativePronunciations: false,
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
		childPrivacyMode: false,
		completedOnboardingVersion: 0,
	});
	onboardingStore.reset();
	vi.mocked(submitInterviewSignup).mockReset().mockResolvedValue(undefined);
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

it('walks Welcome → Preferences → Privacy → Interview and persists version 2 after skipping', async () => {
	const user = userEvent.setup();
	const { getByRole, getByText, queryByLabelText, getByLabelText } =
		await continueFromWelcome(user);

	expect(queryByLabelText('First Tone')).toBeNull();
	expect(getByLabelText('Apply tone coloring to lists')).toBeTruthy();
	expect(getByLabelText('Show qualifiers')).toBeTruthy();
	expect(getByLabelText('Show parts of speech')).toBeTruthy();
	expect(getByLabelText('Show alternative pronunciations')).toBeTruthy();
	expect((getByLabelText('Show qualifiers') as HTMLInputElement).checked).toBe(true);
	expect((getByLabelText('Show parts of speech') as HTMLInputElement).checked).toBe(true);
	expect((getByLabelText('Show alternative pronunciations') as HTMLInputElement).checked).toBe(
		false
	);
	expect(getByText('List result')).toBeTruthy();
	expect(
		(getByRole('radio', { name: 'HSK Exam Syllabus 2025' }) as HTMLInputElement).checked
	).toBe(true);
	const hskRadios = document.querySelectorAll('input[name="hsk-variant"]');
	expect(Array.from(hskRadios, (radio) => (radio as HTMLInputElement).value)).toEqual([
		'hsk_exam_syllabus_2025',
		'hsk_2015',
		'proficiency_standard_2021',
		'none',
	]);
	const characterRadios = document.querySelectorAll('input[name="character-set"]');
	expect((characterRadios[0] as HTMLInputElement).value).toBe('both');

	await user.click(getByRole('radio', { name: 'Traditional' }));
	await user.click(getByRole('radio', { name: 'HSK 2015' }));
	expect(preferenceManager.set).toHaveBeenCalledWith('hskVariant', 'hsk_2015');
	await user.click(getByRole('button', { name: 'Continue' }));
	await waitFor(() => expect(getByText('Privacy')).toBeTruthy());

	expect((getByRole('button', { name: 'Continue' }) as HTMLButtonElement).disabled).toBe(true);
	await user.click(getByRole('button', { name: 'Back' }));
	await waitFor(() =>
		expect((getByRole('radio', { name: 'Traditional' }) as HTMLInputElement).checked).toBe(true)
	);
	expect((getByRole('radio', { name: 'HSK 2015' }) as HTMLInputElement).checked).toBe(true);

	await user.click(getByRole('button', { name: 'Continue' }));
	await waitFor(() => expect(getByText('Country or region')).toBeTruthy());

	await user.selectOptions(getByLabelText('Country or region'), 'US');
	await waitFor(() => expect(getByText('Are you 13 or older?')).toBeTruthy());
	expect(
		Array.from(document.querySelectorAll('.privacy-step__age-actions button'), (button) =>
			button.textContent?.trim()
		)
	).toEqual(['No', 'Yes']);
	expect((getByRole('button', { name: 'Continue' }) as HTMLButtonElement).disabled).toBe(true);

	await user.click(getByRole('button', { name: 'Yes' }));
	await waitFor(() => expect(getByLabelText('Enable Telemetry')).toBeTruthy());
	expect(getByRole('button', { name: 'Yes' }).getAttribute('aria-pressed')).toBe('true');
	expect(getByLabelText('Event Tracking')).toBeTruthy();
	expect(getByLabelText('Screen Views')).toBeTruthy();
	expect(getByLabelText('Error Reporting')).toBeTruthy();
	expect(getByLabelText('Device Context')).toBeTruthy();
	expect(getByText('Example payloads')).toBeTruthy();
	expect(getByText(/onboarding.step_viewed/)).toBeTruthy();
	expect((getByRole('button', { name: 'Continue' }) as HTMLButtonElement).disabled).toBe(false);

	await user.click(getByRole('button', { name: 'Continue' }));

	await waitFor(() => expect(getByText('Help shape Syng')).toBeTruthy());
	await user.click(getByRole('button', { name: 'Skip' }));
	expect(preferenceManager.set).toHaveBeenCalledWith('completedOnboardingVersion', 2);
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
	expect(queryByText('Are you 13 or older?')).toBeNull();

	await user.selectOptions(getByLabelText('Country or region'), 'US');
	await waitFor(() => expect(getByText('Are you 13 or older?')).toBeTruthy());
	expect(queryByLabelText('Enable Telemetry')).toBeNull();

	await user.click(getByRole('button', { name: 'No' }));
	await waitFor(() => expect(queryByLabelText('Enable Telemetry')).toBeNull());
	expect(queryByLabelText('Event Tracking')).toBeNull();
	expect(queryByText('No telemetry is sent with these settings.')).toBeNull();
	expect(telemetry.setPref).toHaveBeenCalledWith('enabled', false);
	expect(
		queryByText('Telemetry is turned off while additional privacy protections apply.')
	).toBeNull();

	await user.click(getByRole('button', { name: 'Get Started' }));
	expect(preferenceManager.set).toHaveBeenCalledWith('childPrivacyMode', true);
	expect(telemetry.trackEvent).not.toHaveBeenCalledWith(
		'onboarding.completed',
		expect.anything()
	);
});

it('waits for the child-privacy telemetry write before allowing completion', async () => {
	const user = userEvent.setup();
	const { getByRole, getByText, getByLabelText } = await continueFromWelcome(user);

	await user.click(getByRole('button', { name: 'Continue' }));
	await waitFor(() => expect(getByText('Privacy')).toBeTruthy());
	await user.selectOptions(getByLabelText('Country or region'), 'US');
	await waitFor(() => expect(getByText('Are you 13 or older?')).toBeTruthy());

	let finishPrivacyWrite!: () => void;
	vi.mocked(telemetry.setPref).mockImplementationOnce(
		() =>
			new Promise<void>((resolve) => {
				finishPrivacyWrite = resolve;
			})
	);

	await user.click(getByRole('button', { name: 'No' }));
	const getStarted = getByRole('button', { name: 'Continue' }) as HTMLButtonElement;
	expect(getStarted.disabled).toBe(true);
	expect(preferenceManager.set).not.toHaveBeenCalledWith('childPrivacyMode', true);
	expect(preferenceManager.set).not.toHaveBeenCalledWith('completedOnboardingVersion', 2);

	finishPrivacyWrite();
	await waitFor(() => expect(getStarted.disabled).toBe(false));
	expect(preferenceManager.set).toHaveBeenCalledWith('childPrivacyMode', true);

	await user.click(getStarted);
	expect(preferenceManager.set).toHaveBeenCalledWith('completedOnboardingVersion', 2);
});

it('waits for the region telemetry reset before accepting an age answer', async () => {
	const user = userEvent.setup();
	const { getByRole, getByText, getByLabelText } = await continueFromWelcome(user);

	await user.click(getByRole('button', { name: 'Continue' }));
	await waitFor(() => expect(getByText('Privacy')).toBeTruthy());

	let finishRegionReset!: () => void;
	vi.mocked(telemetry.setPref).mockImplementationOnce(
		() =>
			new Promise<void>((resolve) => {
				finishRegionReset = resolve;
			})
	);

	const regionSelect = getByLabelText('Country or region') as HTMLSelectElement;
	await user.selectOptions(regionSelect, 'US');
	const ageNo = getByRole('button', { name: 'No' }) as HTMLButtonElement;
	const getStarted = getByRole('button', { name: 'Continue' }) as HTMLButtonElement;

	expect(telemetry.setPref).toHaveBeenCalledWith('enabled', true);
	expect(regionSelect.disabled).toBe(true);
	expect(ageNo.disabled).toBe(true);
	expect(getStarted.disabled).toBe(true);
	expect(preferenceManager.set).not.toHaveBeenCalledWith('regionCode', expect.anything());

	finishRegionReset();
	await waitFor(() => expect(regionSelect.disabled).toBe(false));
	expect(ageNo.disabled).toBe(false);
	expect(getStarted.disabled).toBe(true);
});

it('skips the age question for other regions and allows disabling telemetry', async () => {
	const user = userEvent.setup();
	const { getByRole, getByText, getByLabelText, queryByText } = await continueFromWelcome(user);

	await user.click(getByRole('button', { name: 'Continue' }));
	await waitFor(() => expect(getByText('Privacy')).toBeTruthy());

	await user.selectOptions(getByLabelText('Country or region'), 'CN');
	await waitFor(() => expect(getByLabelText('Enable Telemetry')).toBeTruthy());
	expect(queryByText('Are you 13 or older?')).toBeNull();
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

	await user.click(getByRole('button', { name: 'Continue' }));
	await waitFor(() => expect(getByText('Help shape Syng')).toBeTruthy());
	await user.click(getByRole('button', { name: 'Skip' }));
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

it('shows only the invitation for existing users, with explicit consent and no repeat prompt', async () => {
	privacySettingsStore.setPrivacySettingsForTest({ completedOnboardingVersion: 1 });
	const user = userEvent.setup();
	const { getByRole, getByLabelText, queryByText } = render(OnboardingFlow);
	expect(queryByText('Welcome to Syng')).toBeNull();
	expect(queryByText('Country or region')).toBeNull();
	expect(getByRole('status', { name: 'Step 1 of 1' })).toBeTruthy();
	expect((getByRole('checkbox') as HTMLInputElement).checked).toBe(false);
	await user.type(getByLabelText('What would you like us to call you?'), 'River');
	await user.type(getByLabelText('Email address'), 'river@example.invalid');
	await user.click(getByRole('button', { name: 'Sign up and get started' }));
	expect(submitInterviewSignup).not.toHaveBeenCalled();
	await user.click(getByRole('checkbox'));
	await user.click(getByRole('button', { name: 'Sign up and get started' }));
	await waitFor(() => expect(privacySettingsStore.hasCompletedOnboarding).toBe(true));
	expect(submitInterviewSignup).toHaveBeenCalledWith({
		signup_id: expect.any(String),
		preferred_name: 'River',
		email: 'river@example.invalid',
		consent: true,
		consent_version: INTERVIEW_CONSENT.version,
	});
	expect(telemetry.setPref).not.toHaveBeenCalled();
	expect(JSON.stringify(vi.mocked(telemetry.trackEvent).mock.calls)).not.toContain(
		'river@example.invalid'
	);
	expect(JSON.stringify(vi.mocked(telemetry.trackEvent).mock.calls)).not.toContain('River');
});

it('skips the invitation entirely for existing child-mode users', async () => {
	privacySettingsStore.setPrivacySettingsForTest({
		completedOnboardingVersion: 1,
		childPrivacyMode: true,
	});
	telemetryState.enabled = false;
	const { queryByText, queryByLabelText } = render(OnboardingFlow);
	expect(queryByText('Help shape Syng')).toBeNull();
	expect(queryByLabelText('Email address')).toBeNull();
	await waitFor(() =>
		expect(preferenceManager.set).toHaveBeenCalledWith('completedOnboardingVersion', 2)
	);
	expect(submitInterviewSignup).not.toHaveBeenCalled();
});

it('keeps retries idempotent, changes the ID for edited details, and permits skipping after failure', async () => {
	privacySettingsStore.setPrivacySettingsForTest({ completedOnboardingVersion: 1 });
	telemetryState.enabled = false;
	vi.mocked(submitInterviewSignup).mockRejectedValue('Error echoing private@example.invalid');
	const user = userEvent.setup();
	const { getByRole, getByLabelText, queryByText } = render(OnboardingFlow, {
		variant: 'mobile',
	});
	await user.type(getByLabelText('What would you like us to call you?'), 'River');
	await user.type(getByLabelText('Email address'), 'river@example.invalid');
	await user.click(getByRole('checkbox'));
	await user.click(getByRole('button', { name: 'Sign up and get started' }));
	await waitFor(() => expect(getByRole('alert')).toBeTruthy());
	expect(queryByText(/Error echoing/)).toBeNull();
	expect(privacySettingsStore.hasCompletedOnboarding).toBe(false);
	const first = vi.mocked(submitInterviewSignup).mock.calls[0][0];
	await user.click(getByRole('button', { name: 'Sign up and get started' }));
	await waitFor(() => expect(submitInterviewSignup).toHaveBeenCalledTimes(2));
	expect(vi.mocked(submitInterviewSignup).mock.calls[1][0].signup_id).toBe(first.signup_id);
	await user.type(getByLabelText('What would you like us to call you?'), ' Two');
	await user.click(getByRole('button', { name: 'Sign up and get started' }));
	await waitFor(() => expect(submitInterviewSignup).toHaveBeenCalledTimes(3));
	expect(vi.mocked(submitInterviewSignup).mock.calls[2][0].signup_id).not.toBe(first.signup_id);
	await user.click(getByRole('button', { name: 'Skip' }));
	expect(privacySettingsStore.hasCompletedOnboarding).toBe(true);
	expect(telemetry.setPref).not.toHaveBeenCalled();
});

it('prevents duplicate clicks while saving and accepts a signup with telemetry disabled', async () => {
	privacySettingsStore.setPrivacySettingsForTest({ completedOnboardingVersion: 1 });
	telemetryState.enabled = false;
	let finish!: () => void;
	vi.mocked(submitInterviewSignup).mockImplementationOnce(
		() =>
			new Promise<void>((resolve) => {
				finish = resolve;
			})
	);
	const user = userEvent.setup();
	const { getByRole, getByLabelText } = render(OnboardingFlow);
	await user.type(getByLabelText('What would you like us to call you?'), 'River');
	await user.type(getByLabelText('Email address'), 'invalid');
	await user.click(getByRole('checkbox'));
	await user.click(getByRole('button', { name: 'Sign up and get started' }));
	expect(submitInterviewSignup).not.toHaveBeenCalled();
	await user.clear(getByLabelText('Email address'));
	await user.type(getByLabelText('Email address'), 'river@example.invalid');
	await user.dblClick(getByRole('button', { name: 'Sign up and get started' }));
	expect(submitInterviewSignup).toHaveBeenCalledTimes(1);
	expect((getByRole('button', { name: 'Skip' }) as HTMLButtonElement).disabled).toBe(true);
	expect(privacySettingsStore.hasCompletedOnboarding).toBe(false);
	finish();
	await waitFor(() => expect(privacySettingsStore.hasCompletedOnboarding).toBe(true));
	expect(telemetry.setPref).not.toHaveBeenCalled();
});
