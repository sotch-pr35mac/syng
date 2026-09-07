import { beforeEach, expect, vi } from 'vitest';
import { render, waitFor } from '@testing-library/svelte';
import App from '@/App.svelte';
import { privacySettingsStore } from '@/stores/privacySettings.svelte.js';

vi.mock('lucide-svelte', async () => {
	const mockIcon = (await import('@/components/__mocks__/FeatherIcon.svelte')).default;
	return {
		Award: mockIcon,
		Bookmark: mockIcon,
		BookOpen: mockIcon,
		CircleQuestionMark: mockIcon,
		EllipsisVertical: mockIcon,
		GraduationCap: mockIcon,
		MessageCircle: mockIcon,
		Search: mockIcon,
		Settings: mockIcon,
		SquareStack: mockIcon,
		X: mockIcon,
	};
});

vi.mock('@/utils/startup.js', () => ({
	runStartupActions: vi.fn(),
	waitForStartupComplete: vi.fn(() => Promise.resolve()),
}));

vi.mock('@/utils/updateManager.js', () => ({
	installPendingUpdate: vi.fn(),
}));

vi.mock('@/utils/telemetry.js', () => ({
	getRouteScreenName: (location, screenNames) => screenNames[location],
	telemetry: {
		trackScreen: vi.fn(() => Promise.resolve()),
		trackEvent: vi.fn(() => Promise.resolve()),
		getPrefs: vi.fn(() =>
			Promise.resolve({
				enabled: true,
				track_events: true,
				track_screen_views: true,
				track_errors: true,
				include_device_context: true,
			})
		),
		setPref: vi.fn(() => Promise.resolve()),
	},
}));

vi.mock('@/components/SyToast/SyToast.svelte', async () => ({
	default: (await import('@/components/__mocks__/RouteMock.svelte')).default,
}));
vi.mock('@/utils/error.js', () => ({
	handleError: vi.fn(),
}));
vi.mock('@/components/Navigation/Navigation.svelte', async () => ({
	default: (await import('@/components/__mocks__/RouteMock.svelte')).default,
}));
vi.mock('@/routes/Search.svelte', async () => ({
	default: (await import('@/components/__mocks__/RouteMock.svelte')).default,
}));
vi.mock('@/routes/Bookmarks.svelte', async () => ({
	default: (await import('@/components/__mocks__/RouteMock.svelte')).default,
}));
vi.mock('@/routes/Chat.svelte', async () => ({
	default: (await import('@/components/__mocks__/RouteMock.svelte')).default,
}));
vi.mock('@/routes/Help.svelte', async () => ({
	default: (await import('@/components/__mocks__/RouteMock.svelte')).default,
}));
vi.mock('@/routes/NotFound.svelte', async () => ({
	default: (await import('@/components/__mocks__/RouteMock.svelte')).default,
}));
vi.mock('@/routes/Reader/Library.svelte', async () => ({
	default: (await import('@/components/__mocks__/RouteMock.svelte')).default,
}));
vi.mock('@/routes/Reader/Document.svelte', async () => ({
	default: (await import('@/components/__mocks__/RouteMock.svelte')).default,
}));
vi.mock('@/routes/Settings.svelte', async () => ({
	default: (await import('@/components/__mocks__/RouteMock.svelte')).default,
}));
vi.mock('@/routes/Study.svelte', async () => ({
	default: (await import('@/components/__mocks__/RouteMock.svelte')).default,
}));
vi.mock('@/routes/Tools.svelte', async () => ({
	default: (await import('@/components/__mocks__/RouteMock.svelte')).default,
}));
vi.mock('@/routes/Study/Flashcards.svelte', async () => ({
	default: (await import('@/components/__mocks__/RouteMock.svelte')).default,
}));
vi.mock('@/routes/Study/Quiz.svelte', async () => ({
	default: (await import('@/components/__mocks__/RouteMock.svelte')).default,
}));
vi.mock('@/routes/mobile/MobileCharacters.svelte', async () => ({
	default: (await import('@/components/__mocks__/RouteMock.svelte')).default,
}));

beforeEach(() => {
	window.location.hash = '#/';
	privacySettingsStore.setPrivacySettingsForTest({
		regionCode: null,
		childPrivacyMode: false,
		completedOnboardingVersion: 1,
	});
	window.matchMedia = vi.fn().mockImplementation(() => ({
		matches: false,
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
	}));
	Element.prototype.animate =
		Element.prototype.animate ||
		(() => ({
			finished: Promise.resolve(),
			cancel: () => {},
			addEventListener: () => {},
			removeEventListener: () => {},
		}));
});

it('shows onboarding instead of search when onboarding has not been completed', async () => {
	privacySettingsStore.setPrivacySettingsForTest({
		completedOnboardingVersion: 0,
	});
	const { getByText, queryByTestId } = render(App);

	await waitFor(() => expect(getByText('Welcome to Syng')).toBeTruthy());
	expect(queryByTestId('route-mock')).toBeNull();
});

it('shows the app chrome after onboarding is completed', async () => {
	const { container, queryByText } = render(App);

	await waitFor(() => expect(container.querySelector('.app-container')).toBeTruthy());
	expect(queryByText('Welcome to Syng')).toBeNull();
});

it('shows onboarding when replay is requested for an existing install', async () => {
	privacySettingsStore.setPrivacySettingsForTest({
		completedOnboardingVersion: 1,
		forceOnboardingReplay: true,
	});
	const { getByText, queryByTestId } = render(App);

	await waitFor(() => expect(getByText('Welcome to Syng')).toBeTruthy());
	expect(queryByTestId('route-mock')).toBeNull();
});
