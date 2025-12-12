/* eslint-disable no-undef */
import { vi } from 'vitest';
import { handleError } from './error.js';

it('should alert the user with the error message', async () => {
	global.alert = vi.fn();
	handleError('message');
	expect(global.alert).toHaveBeenCalledWith('message');
});

it('should print additional information to the console', async () => {
	global.alert = vi.fn();
	global.console.error = vi.fn();
	handleError('message', 'additional information');
	expect(global.alert).toHaveBeenCalledWith('message');
	expect(global.console.error).toHaveBeenCalledWith('additional information');
});