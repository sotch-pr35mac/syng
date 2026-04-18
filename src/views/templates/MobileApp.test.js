import { beforeEach, expect, vi } from 'vitest';
import { render, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import MobileApp from './MobileApp.svelte';
import { telemetry } from './utils';

vi.mock('lucide-svelte', async () => {
	const mockIcon = (await import('./components/__mocks__/FeatherIcon.svelte')).default;
	return {
		Settings: mockIcon,
	};
});

vi.mock('./utils', async () => {
	const actual = await vi.importActual('./utils');
	return {
		...actual,
		runStartupActions: vi.fn(),
		telemetry: {
			trackScreen: vi.fn(() => Promise.resolve()),
		},
	};
});

vi.mock('./routes/mobile/MobileSearch.svelte', async () => ({
	default: (await import('./components/__mocks__/RouteMock.svelte')).default,
}));
vi.mock('./routes/mobile/MobileBookmarks.svelte', async () => ({
	default: (await import('./components/__mocks__/RouteMock.svelte')).default,
}));
vi.mock('./routes/mobile/MobileStudy.svelte', async () => ({
	default: (await import('./components/__mocks__/RouteMock.svelte')).default,
}));
vi.mock('./routes/mobile/MobileStudyFlashcards.svelte', async () => ({
	default: (await import('./components/__mocks__/RouteMock.svelte')).default,
}));
vi.mock('./routes/mobile/MobileStudyQuiz.svelte', async () => ({
	default: (await import('./components/__mocks__/RouteMock.svelte')).default,
}));
vi.mock('./routes/mobile/MobileSettings.svelte', async () => ({
	default: (await import('./components/__mocks__/RouteMock.svelte')).default,
}));
vi.mock('./routes/mobile/MobileCharacters.svelte', async () => ({
	default: (await import('./components/__mocks__/RouteMock.svelte')).default,
}));
vi.mock('./routes/NotFound.svelte', async () => ({
	default: (await import('./components/__mocks__/RouteMock.svelte')).default,
}));

beforeEach(() => {
	vi.mocked(telemetry.trackScreen).mockClear();
	window.location.hash = '#/';
});

it('tracks screen views for mobile route changes', async () => {
	const user = userEvent.setup();
	const { getByText } = render(MobileApp);

	await waitFor(() => expect(telemetry.trackScreen).toHaveBeenCalledWith('search'));

	await user.click(getByText('Bookmarks'));
	await waitFor(() => expect(telemetry.trackScreen).toHaveBeenCalledWith('bookmarks'));

	await user.click(getByText('Study'));
	await waitFor(() => expect(telemetry.trackScreen).toHaveBeenCalledWith('study'));
});
