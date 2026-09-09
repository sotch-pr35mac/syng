import { beforeEach, expect, it, vi } from 'vitest';

beforeEach(() => {
	vi.resetModules();
});

it('backfills newer settings into existing preference documents', async () => {
	global.PouchDB = class {
		get = vi.fn(() =>
			Promise.resolve({
				_id: 'config',
				_rev: '1-existing',
				beta: { requiresRestart: true, value: false },
				toneColors: {
					requiresRestart: true,
					value: {
						colors: ['--sy-color--blue-3'],
						hasCustomColors: false,
					},
				},
			})
		);
		put = vi.fn(() => Promise.resolve({ ok: true, rev: '2-migrated' }));
	};
	const { PreferenceManager } = await import('@/utils/preferenceManager.js');
	const manager = new PreferenceManager('config');

	await manager.init();

	expect(manager.get('readerSettings')).toEqual(
		expect.objectContaining({
			colorTheme: 'automatic',
			fontSizePercent: 100,
			backgroundColor: '#ffffff',
			textColor: '#171717',
		})
	);
	expect(manager.get('characterSet')).toBe('both');
	expect(manager.get('colorCharactersByTone')).toBe(true);
	expect(manager.get('colorPinyinByTone')).toBe(false);
	expect(manager.get('colorListsByTone')).toBe(false);
	expect(manager.get('hskVariant')).toBe('hsk_exam_syllabus_2025');
	expect(manager.get('childPrivacyMode')).toBe(false);
	expect(manager.get('completedOnboardingVersion')).toBe(0);
	expect(manager.get('forceOnboardingReplay')).toBe(false);
});

it('does not mark existing preference documents as having completed onboarding', async () => {
	const put = vi.fn(() => Promise.resolve({ ok: true, rev: '2-migrated' }));
	global.PouchDB = class {
		get = vi.fn(() =>
			Promise.resolve({
				_id: 'config',
				_rev: '1-existing',
				beta: { requiresRestart: true, value: false },
			})
		);
		put = put;
	};
	const { PreferenceManager } = await import('@/utils/preferenceManager.js');
	const manager = new PreferenceManager('config');

	await manager.init();

	expect(manager.get('completedOnboardingVersion')).toBe(0);
	expect(put).not.toHaveBeenCalled();
});

it('drops a region persisted by an older development build', async () => {
	const put = vi.fn();
	global.PouchDB = class {
		get = vi.fn(() =>
			Promise.resolve({
				_id: 'config',
				_rev: '1-in-progress',
				completedOnboardingVersion: { requiresRestart: false, value: 0 },
				regionCode: { requiresRestart: false, value: 'US' },
			})
		);
		put = put;
	};
	const { PreferenceManager } = await import('@/utils/preferenceManager.js');
	const manager = new PreferenceManager('config');

	await manager.init();

	expect(manager.get('completedOnboardingVersion')).toBe(0);
	expect(manager._config).not.toHaveProperty('regionCode');
	expect(put).not.toHaveBeenCalled();
});

it('uses dictionary display defaults for new preference documents', async () => {
	global.PouchDB = class {
		get = vi.fn(() => Promise.reject({ name: 'not_found' }));
	};
	const { PreferenceManager } = await import('@/utils/preferenceManager.js');
	const manager = new PreferenceManager('config');

	await manager.init();

	expect(manager.get('characterSet')).toBe('both');
	expect(manager.get('colorCharactersByTone')).toBe(true);
	expect(manager.get('colorPinyinByTone')).toBe(false);
	expect(manager.get('colorListsByTone')).toBe(false);
	expect(manager.get('hskVariant')).toBe('hsk_exam_syllabus_2025');
	expect(manager.get('completedOnboardingVersion')).toBe(0);
	expect(manager.get('childPrivacyMode')).toBe(false);
	expect(manager.get('forceOnboardingReplay')).toBe(false);
});

it('serializes rapid preference writes so overlapping puts do not conflict', async () => {
	vi.spyOn(console, 'error').mockImplementation(() => {});
	const handleError = vi.fn();
	vi.doMock('@/utils/error.js', () => ({ handleError }));

	let inFlightPuts = 0;
	let maxInFlightPuts = 0;
	let revision = 0;
	const put = vi.fn(() => {
		inFlightPuts += 1;
		maxInFlightPuts = Math.max(maxInFlightPuts, inFlightPuts);
		return new Promise((resolve) => {
			setTimeout(() => {
				inFlightPuts -= 1;
				revision += 1;
				resolve({ ok: true, rev: `${revision}-saved` });
			}, 20);
		});
	});
	global.PouchDB = class {
		get = vi.fn(() => Promise.reject({ name: 'not_found' }));
		put = put;
	};
	const { PreferenceManager } = await import('@/utils/preferenceManager.js');
	const manager = new PreferenceManager('config');
	await manager.init();

	manager.set('childPrivacyMode', true);
	manager.set('completedOnboardingVersion', 1);
	await manager._writeQueue;

	expect(manager.get('childPrivacyMode')).toBe(true);
	expect(manager.get('completedOnboardingVersion')).toBe(1);
	expect(put).toHaveBeenCalledTimes(2);
	expect(maxInFlightPuts).toBe(1);
	expect(handleError).not.toHaveBeenCalled();
});

it('retries a conflicting put with the latest revision', async () => {
	vi.spyOn(console, 'error').mockImplementation(() => {});
	const handleError = vi.fn();
	vi.doMock('@/utils/error.js', () => ({ handleError }));

	const put = vi
		.fn()
		.mockRejectedValueOnce({ status: 409, name: 'conflict' })
		.mockResolvedValueOnce({ ok: true, rev: '3-retry' });
	global.PouchDB = class {
		get = vi
			.fn()
			.mockResolvedValueOnce({
				_id: 'config',
				_rev: '1-existing',
				beta: { requiresRestart: true, value: false },
			})
			.mockResolvedValueOnce({
				_id: 'config',
				_rev: '2-disk',
			});
		put = put;
	};
	const { PreferenceManager } = await import('@/utils/preferenceManager.js');
	const manager = new PreferenceManager('config');
	await manager.init();

	manager.set('childPrivacyMode', true);
	await manager._writeQueue;

	expect(manager.get('childPrivacyMode')).toBe(true);
	expect(put).toHaveBeenCalledTimes(2);
	expect(handleError).not.toHaveBeenCalled();
});

it('rejects waitForInit when loading preferences fails instead of hanging', async () => {
	vi.spyOn(console, 'error').mockImplementation(() => {});
	global.PouchDB = class {
		get = vi.fn(() => Promise.reject({ name: 'unauthorized' }));
	};
	const { PreferenceManager } = await import('@/utils/preferenceManager.js');
	const manager = new PreferenceManager('config');

	await expect(manager.waitForInit()).rejects.toThrow(
		'There was an error loading user preferences.'
	);
	expect(manager.initialized).toBe(false);
});
