import { beforeEach, expect, it, vi } from 'vitest';

beforeEach(() => {
	vi.resetModules();
});

it('backfills reader settings into existing preference documents', async () => {
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
			colorTheme: 'light',
			fontSizePercent: 100,
			backgroundColor: '#ffffff',
			textColor: '#171717',
		})
	);
});
