 
import { vi } from 'vitest';
import { render } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { mockGlobalTauri } from '../../test/utils/unitTestUtils.js';
import CharacterWindow from './CharacterWindow.svelte';
import HanziWriter from 'hanzi-writer'; //eslint-disable-line no-unused-vars

// Mock must be defined with async factory because vi.mock is hoisted before imports
vi.mock('lucide-svelte', async () => {
	const mockIcon = (await import('./components/__mocks__/FeatherIcon.svelte')).default;
	return {
		Play: mockIcon,
		Pause: mockIcon,
	};
});

vi.mock('hanzi-writer', () => {
	return {
		'default': {
			create: (param1, param2, param3) => { // eslint-disable-line no-unused-vars
				return {
					hideCharacter: vi.fn(),
					animateCharacter: vi.fn(),
					pauseAnimation: vi.fn(),
					resumeAnimation: vi.fn()
				};
			}
		}
	};
});

// Mock @tauri-apps/plugin-os
vi.mock('@tauri-apps/plugin-os', () => ({
	platform: () => 'macos'
}));

const WORD = {
	simplified: '你好',
	traditional: '你好'
};
const mockMatchMedia = vi.fn().mockReturnValue({
	addEventListener: (e, cb) => undefined // eslint-disable-line no-unused-vars
});
global.__TAURI__ = mockGlobalTauri({
	events: {
		'display-characters': WORD
	}
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