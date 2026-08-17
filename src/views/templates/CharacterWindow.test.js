import { beforeEach, vi } from 'vitest';
import { render, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { wait } from '@test/utils/unitTestUtils.js';
import CharacterWindow from '@/CharacterWindow.svelte';
import HanziWriter from 'hanzi-writer';

const eventMocks = vi.hoisted(() => ({
	displayCharactersListener: undefined,
}));

// Mock must be defined with async factory because vi.mock is hoisted before imports
vi.mock('lucide-svelte', async () => {
	const mockIcon = (await import('@/components/__mocks__/FeatherIcon.svelte')).default;
	return {
		Play: mockIcon,
		Pause: mockIcon,
	};
});

vi.mock('hanzi-writer', () => {
	return {
		default: {
			create: vi.fn((_param1, _param2, _param3) => {
				return {
					hideCharacter: vi.fn(),
					animateCharacter: vi.fn(),
					pauseAnimation: vi.fn(),
					resumeAnimation: vi.fn(),
				};
			}),
		},
	};
});

// Mock @tauri-apps/plugin-os
vi.mock('@tauri-apps/plugin-os', () => ({
	platform: () => 'macos',
}));

const WORD = {
	simplified: '汉字',
	traditional: '漢字',
};

vi.mock('@tauri-apps/api/event', () => ({
	listen: vi.fn((event, callback) => {
		if (event === 'display-characters') {
			eventMocks.displayCharactersListener = callback;
			wait(() => callback({ payload: WORD }));
		}
		return Promise.resolve(() => {});
	}),
}));

const mockMatchMedia = vi.fn().mockReturnValue({
	addEventListener: (event, callback) => undefined, // eslint-disable-line no-unused-vars
});

beforeEach(() => {
	vi.mocked(HanziWriter.create).mockClear();
});

it('should highlight the tab that you click on', async () => {
	const highlightClass = 'script-selector--active';
	const user = userEvent.setup();
	window.matchMedia = mockMatchMedia;
	const word = vi.fn().mockReturnValue(WORD); // eslint-disable-line no-unused-vars
	const { getByText } = render(CharacterWindow, {});

	// Make sure Simplified is selected by default
	const traditionalTab = getByText('Traditional');
	let traditionalClasses = traditionalTab.className.split(' ');
	let simplifiedClasses = getByText('Simplified').className.split(' ');
	expect(simplifiedClasses).toContain(highlightClass);
	expect(traditionalClasses).not.toContain(highlightClass);

	// Test highlight switches after clicking on the other tab
	await user.click(traditionalTab);
	traditionalClasses = getByText('Traditional').className.split(' ');
	simplifiedClasses = getByText('Simplified').className.split(' ');
	expect(simplifiedClasses).not.toContain(highlightClass);
	expect(traditionalClasses).toContain(highlightClass);
});

it('should update the tooltip as you click it', async () => {
	const user = userEvent.setup();
	window.matchMedia = mockMatchMedia;
	const { getByTestId } = render(CharacterWindow, {});
	const controlButton = getByTestId('control-button');
	const tooltip = getByTestId('tooltip-text');

	// Move the cursor over the control button
	await user.hover(controlButton);

	// Test tooltip before first interaction
	expect(tooltip.textContent).toBe('Play Stroke Order');

	// Test tooltip after first interaction
	await user.click(controlButton);
	expect(tooltip.textContent).toBe('Pause');

	// Test tooltip after second interaction
	await user.click(controlButton);
	expect(tooltip.textContent).toBe('Resume');
});

it('opens on a requested script', async () => {
	window.matchMedia = mockMatchMedia;
	const { getByText } = render(CharacterWindow, {});

	await waitFor(() => expect(eventMocks.displayCharactersListener).toBeTypeOf('function'));
	eventMocks.displayCharactersListener({
		payload: { ...WORD, initialScript: 'traditional' },
	});

	await waitFor(() =>
		expect(vi.mocked(HanziWriter.create)).toHaveBeenCalledWith(
			'character-target',
			'漢',
			expect.any(Object)
		)
	);
	expect(getByText('Traditional').className).toContain('script-selector--active');
});

it('keeps the current script when no initial script is requested', async () => {
	const user = userEvent.setup();
	window.matchMedia = mockMatchMedia;
	const { getByText } = render(CharacterWindow, {});
	await waitFor(() => expect(eventMocks.displayCharactersListener).toBeTypeOf('function'));

	await user.click(getByText('Traditional'));
	eventMocks.displayCharactersListener({ payload: WORD });

	await waitFor(() =>
		expect(vi.mocked(HanziWriter.create)).toHaveBeenCalledWith(
			'character-target',
			'漢',
			expect.any(Object)
		)
	);
	expect(getByText('Traditional').className).toContain('script-selector--active');
});
