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
