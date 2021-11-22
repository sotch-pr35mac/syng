/* eslint-disable no-undef */
import { handleError } from './error.js';

it('should alert the user with the error message', async () => {
	global.alert = jest.fn();
	handleError('message');
	expect(global.alert).toHaveBeenCalledWith('message');
});

it('should print additional information to the console', async () => {
	global.alert = jest.fn();
	global.console.error = jest.fn();
	handleError('message', 'additional information');
	expect(global.alert).toHaveBeenCalledWith('message');
	expect(global.console.error).toHaveBeenCalledWith('additional information');
});
