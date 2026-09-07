import { afterEach, beforeEach, expect, vi } from 'vitest';
import { render, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import MobileApp from '@/MobileApp.svelte';
import { telemetry } from '@/utils/telemetry.js';
import { databaseMigrationStore } from '@/stores/databaseMigration.svelte.js';
import { privacySettingsStore } from '@/stores/privacySettings.svelte.js';

vi.mock('lucide-svelte', async () => {
	const mockIcon = (await import('@/components/__mocks__/FeatherIcon.svelte')).default;
	return {
		Award: mockIcon,
		Bookmark: mockIcon,
		BookOpen: mockIcon,
		EllipsisVertical: mockIcon,
		GraduationCap: mockIcon,
		Search: mockIcon,
		Settings: mockIcon,
		SquareStack: mockIcon,
	};
});

vi.mock('@/utils/startup.js', () => ({
	runStartupActions: vi.fn(),
	waitForStartupComplete: vi.fn(() => Promise.resolve()),
}));

vi.mock('@/utils/appLifecycle.js', () => ({
	startLifecycleDiagnostics: vi.fn(() => () => {}),
}));

vi.mock('@/routes/mobile/MobileSearch.svelte', async () => ({
	default: (await import('@/components/__mocks__/RouteMock.svelte')).default,
}));
vi.mock('@/routes/mobile/Reader/MobileReader.svelte', async () => ({
	default: (await import('@/components/__mocks__/RouteMock.svelte')).default,
}));
vi.mock('@/routes/mobile/MobileBookmarks.svelte', async () => ({
	default: (await import('@/components/__mocks__/RouteMock.svelte')).default,
}));
vi.mock('@/routes/mobile/MobileStudy.svelte', async () => ({
	default: (await import('@/components/__mocks__/RouteMock.svelte')).default,
}));
vi.mock('@/routes/mobile/Study/MobileStudyFlashcards.svelte', async () => ({
	default: (await import('@/components/__mocks__/RouteMock.svelte')).default,
}));
vi.mock('@/routes/mobile/Study/MobileStudyQuiz.svelte', async () => ({
	default: (await import('@/components/__mocks__/RouteMock.svelte')).default,
}));
vi.mock('@/routes/mobile/MobileSettings.svelte', async () => ({
	default: (await import('@/components/__mocks__/RouteMock.svelte')).default,
}));
vi.mock('@/routes/mobile/MobileTools.svelte', async () => ({
	default: (await import('@/components/__mocks__/RouteMock.svelte')).default,
}));
vi.mock('@/routes/mobile/MobileCharacters.svelte', async () => ({
	default: (await import('@/components/__mocks__/RouteMock.svelte')).default,
}));
vi.mock('@/routes/NotFound.svelte', async () => ({
	default: (await import('@/components/__mocks__/RouteMock.svelte')).default,
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

beforeEach(() => {
	vi.mocked(telemetry.trackScreen).mockClear();
	databaseMigrationStore.resetForTest();
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

afterEach(() => databaseMigrationStore.resetForTest());

it('tracks screen views for mobile route changes', async () => {
	const user = userEvent.setup();
	const { getByRole } = render(MobileApp);

	await waitFor(() => expect(getByRole('link', { name: 'Search' })).toBeTruthy());
	['Search', 'Read', 'Bookmarks', 'Study', 'Extras', 'Settings'].forEach((label) => {
		expect(getByRole('link', { name: label })).toBeTruthy();
	});

	await waitFor(() => expect(telemetry.trackScreen).toHaveBeenCalledWith('search'));

	await user.click(getByRole('link', { name: 'Bookmarks' }));
	await waitFor(() => expect(telemetry.trackScreen).toHaveBeenCalledWith('bookmarks'));

	await user.click(getByRole('link', { name: 'Read' }));
	await waitFor(() => expect(telemetry.trackScreen).toHaveBeenCalledWith('library'));

	await user.click(getByRole('link', { name: 'Study' }));
	await waitFor(() => expect(telemetry.trackScreen).toHaveBeenCalledWith('study'));
});

it('keeps mobile navigation and routes inert while a migration is active', () => {
	databaseMigrationStore.start({
		title: 'Updating your bookmarks…',
		detail: 'This only needs to happen once.',
	});
	const { getByTestId, queryByRole } = render(MobileApp);

	expect(getByTestId('database-migration-screen')).toBeTruthy();
	expect(queryByRole('link', { name: 'Search' })).toBeNull();
});

it('shows onboarding instead of search when onboarding has not been completed', async () => {
	privacySettingsStore.setPrivacySettingsForTest({
		completedOnboardingVersion: 0,
	});
	const { getByText, queryByRole } = render(MobileApp);

	await waitFor(() => expect(getByText('Welcome to Syng')).toBeTruthy());
	expect(queryByRole('link', { name: 'Search' })).toBeNull();
});

it('shows search after onboarding is completed', async () => {
	const { getByRole, queryByText } = render(MobileApp);

	await waitFor(() => expect(getByRole('link', { name: 'Search' })).toBeTruthy());
	expect(queryByText('Welcome to Syng')).toBeNull();
});

it('shows onboarding when replay is requested for an existing install', async () => {
	privacySettingsStore.setPrivacySettingsForTest({
		completedOnboardingVersion: 1,
		forceOnboardingReplay: true,
	});
	const { getByText, queryByRole } = render(MobileApp);

	await waitFor(() => expect(getByText('Welcome to Syng')).toBeTruthy());
	expect(queryByRole('link', { name: 'Search' })).toBeNull();
});
