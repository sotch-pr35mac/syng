import { beforeEach, expect, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import Settings from '@/routes/Settings.svelte';
import { dictionaryDisplaySettingsStore } from '@/stores/dictionaryDisplaySettings.svelte.js';
import { settingsActiveTabStore } from '@/stores/settings.svelte.js';
import { setPreferenceManagerForTest } from '@/utils/appServices.js';
import { telemetry } from '@/utils/telemetry.js';
import { databaseMigrationStore } from '@/stores/databaseMigration.svelte.js';

vi.mock('@/components/SettingsOption/UpdateChecker.svelte', async () => ({
	default: (await import('@/components/__mocks__/FeatherIcon.svelte')).default,
}));

vi.mock('@tauri-apps/plugin-os', () => ({
	platform: () => 'macos',
	version: () => Promise.resolve('15.0'),
}));

vi.mock('@tauri-apps/api/core', () => ({
	invoke: vi.fn(() => Promise.resolve(false)),
}));

vi.mock('@/utils/device.js', () => ({
	isMobile: () => false,
	isIPad: () => false,
	isIos: () => false,
	isAndroid: () => false,
	isMobileLayout: () => false,
}));

vi.mock('@/utils/telemetry.js', () => ({
	telemetry: {
		trackEvent: vi.fn(() => Promise.resolve()),
	},
}));

const toneColors = {
	hasCustomColors: false,
	colors: ['#3366ff', '#ffcc00', '#ff3333', '#33aa66', '#777777'],
};

let preferenceManager;

beforeEach(async () => {
	settingsActiveTabStore.set('general');
	databaseMigrationStore.resetForTest();
	const preferences = {
		beta: false,
		characterSet: 'both',
		colorCharactersByTone: true,
		colorPinyinByTone: false,
		colorListsByTone: false,
		toneColors,
	};
	preferenceManager = {
		waitForInit: vi.fn(() => Promise.resolve()),
		get: vi.fn((name) => preferences[name]),
		set: vi.fn((name, value) => {
			preferences[name] = value;
		}),
	};
	setPreferenceManagerForTest(preferenceManager);
	await dictionaryDisplaySettingsStore.loadSettings();
	vi.mocked(telemetry.trackEvent).mockClear();
});

it('starts a dismissible database migration preview from development settings', async () => {
	const user = userEvent.setup();
	const { getByRole, getByText } = render(Settings);

	expect(getByText('Database Migration')).toBeTruthy();
	await user.click(getByRole('button', { name: 'Preview migration screen' }));

	expect(databaseMigrationStore.status).toBe('running');
	expect(databaseMigrationStore.isPreview).toBe(true);
	expect(databaseMigrationStore.title).toBe('Updating your bookmarks…');
});

it('renders and updates desktop dictionary display settings', async () => {
	const user = userEvent.setup();
	const { getByRole, getByLabelText, getByText } = render(Settings);

	expect(getByText('Tone Coloring')).toBeTruthy();
	expect(getByText('Tone Colors')).toBeTruthy();
	expect(getByRole('radio', { name: 'Simplified + Traditional' }).checked).toBe(true);
	expect(getByLabelText('Color characters by tone').checked).toBe(true);
	expect(getByLabelText('Color pinyin by tone').checked).toBe(false);
	expect(getByLabelText('Apply tone coloring to lists').checked).toBe(false);

	await user.click(getByRole('radio', { name: 'Traditional' }));
	await user.click(getByLabelText('Color pinyin by tone'));
	await user.click(getByLabelText('Apply tone coloring to lists'));

	expect(preferenceManager.set).toHaveBeenCalledWith('characterSet', 'traditional');
	expect(preferenceManager.set).toHaveBeenCalledWith('colorPinyinByTone', true);
	expect(preferenceManager.set).toHaveBeenCalledWith('colorListsByTone', true);
	expect(telemetry.trackEvent).toHaveBeenCalledWith('settings.changed', {
		setting: 'characterSet',
	});
});
