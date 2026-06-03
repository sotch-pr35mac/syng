import { beforeEach, expect, vi } from 'vitest';
import { render, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import MobileApp from '@/MobileApp.svelte';
import { telemetry } from '@/utils';

vi.mock('lucide-svelte', async () => {
	const mockIcon = (await import('@/components/__mocks__/FeatherIcon.svelte')).default;
	return {
		Bookmark: mockIcon,
		BookOpen: mockIcon,
		EllipsisVertical: mockIcon,
		GraduationCap: mockIcon,
		Search: mockIcon,
		Settings: mockIcon,
	};
});

vi.mock('@/utils', async () => {
	const actual = await vi.importActual('@/utils');
	return {
		...actual,
		runStartupActions: vi.fn(),
		telemetry: {
			trackScreen: vi.fn(() => Promise.resolve()),
		},
	};
});

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

beforeEach(() => {
	vi.mocked(telemetry.trackScreen).mockClear();
	window.location.hash = '#/';
});

it('tracks screen views for mobile route changes', async () => {
	const user = userEvent.setup();
	const { getByRole } = render(MobileApp);

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
