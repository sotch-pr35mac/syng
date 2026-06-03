import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { handleError } from '@/utils/error.js';

beforeEach(() => {
	vi.spyOn(globalThis, 'alert').mockImplementation(() => {});
	vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
	vi.restoreAllMocks();
});

it('should alert the user with the error message', () => {
	handleError('message');
	expect(global.alert).toHaveBeenCalledWith('message');
	expect(console.error).toHaveBeenCalledWith('[handleError]', 'message');
});

it('should print additional information to the console', () => {
	handleError('message', 'additional information');
	expect(global.alert).toHaveBeenCalledWith('message');
	expect(console.error).toHaveBeenCalledWith(
		'[handleError]',
		'message',
		'additional information'
	);
	expect(console.error).toHaveBeenCalledWith('[handleError] serialized', {
		error_message: 'additional information',
	});
});
