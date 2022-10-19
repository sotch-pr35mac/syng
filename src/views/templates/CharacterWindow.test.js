/* eslint-disable no-undef */
import CharacterWindow from './CharacterWindow.svelte';
import { render } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { mockGlobalTauri } from '../../test/utils/unitTestUtils.js';
import HanziWriter from 'hanzi-writer'; //eslint-disable-line no-unused-vars

const WORD = {
	simplified: '你好',
	traditional: '你好'
};
const mockMatchMedia = jest.fn().mockReturnValue({
	addEventListener: (e, cb) => undefined // eslint-disable-line no-unused-vars
});
jest.mock('hanzi-writer', () => {
	return {
		'default': {
			create: (param1, param2, param3) => { // eslint-disable-line no-unused-vars
				return {
					hideCharacter: jest.fn(),
					animateCharacter: jest.fn(),
					pauseAnimation: jest.fn(),
					resumeAnimation: jest.fn()
				};
			}
		}
	};
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
	const word = jest.fn().mockReturnValue(WORD); // eslint-disable-line no-unused-vars
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
	expect(tooltip.innerHTML).toBe('Play Stroke Order');

	// Test tooltip after first interaction
	await user.click(controlButton);
	expect(tooltip.innerHTML).toBe('Pause');

	// Test tooltip after second interaction
	await user.click(controlButton);
	expect(tooltip.innerHTML).toBe('Resume');
});
