/* eslint-disable no-undef */
import { PreferenceManager } from './preferenceManager.js';

it('should return original test value', async () => {
	const pm = new PreferenceManager('some-file');
	pm.init().then(() => {
		const value = pm.get('test');
		expect(value).toBe('test-value');
	});
});

it('should be able to update preferences', async () => {
	const pm = new PreferenceManager('some-file');
	pm.init().then(() => {
		pm.set('test', 'new-value');
		const value = pm.get('test');
		expect(value).toBe('new-value');
	});
});
