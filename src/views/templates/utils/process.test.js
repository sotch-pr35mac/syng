/* eslint-disable no-undef */
import { underTest } from './process.js'; // eslint-disable-line no-unused-vars

describe('underTest', () => {
	it('should reflect the testing environment', () => {
		expect(underTest).toBe(true);
	});
});