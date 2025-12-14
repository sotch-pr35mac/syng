 
import { underTest } from './process.js';  

describe('underTest', () => {
	it('should reflect the testing environment', () => {
		expect(underTest).toBe(true);
	});
});