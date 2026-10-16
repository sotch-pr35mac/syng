import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { appearanceStore } from '@/stores/appearance.svelte.js';
import { getPreferenceManager } from '@/utils/appServices.js';

vi.mock('@/utils/appServices.js', () => ({ getPreferenceManager: vi.fn() }));

const customColors = ['#112233', '#223344', '#334455', '#445566', '#556677'];
const preferences = {
	waitForInit: vi.fn(),
	get: vi.fn(),
	set: vi.fn(),
};
let cleanup: () => void;

beforeEach(() => {
	vi.clearAllMocks();
	window.localStorage.clear();
	preferences.waitForInit.mockResolvedValue(undefined);
	preferences.get.mockImplementation((key: string) =>
		key === 'toneColors' ? { hasCustomColors: true, colors: [...customColors] } : false
	);
	vi.mocked(getPreferenceManager).mockReturnValue(
		preferences as unknown as ReturnType<typeof getPreferenceManager>
	);
	cleanup = appearanceStore.initialize();
});

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

it('defaults to Original and immediately persists a reversible choice without changing tone preferences', async () => {
	await appearanceStore.loadSettings();
	expect(document.documentElement.dataset.appearance).toBe('original');
	for (let index = 0; index < 5; index += 1) {
		expect(
			document.documentElement.style.getPropertyValue(`--sy-tone-color--${index + 1}`)
		).toBe(customColors[index]);
	}
	appearanceStore.setIncreaseContrast(true);
	expect(appearanceStore.increaseContrast).toBe(true);
	expect(document.documentElement.dataset.appearance).toBe('contrast');
	expect(window.localStorage.getItem('syng:appearance')).toBe('contrast');
	for (let index = 0; index < 5; index += 1) {
		expect(
			document.documentElement.style.getPropertyValue(`--sy-tone-color--${index + 1}`)
		).toBe('');
	}
	appearanceStore.setIncreaseContrast(false);
	expect(document.documentElement.dataset.appearance).toBe('original');
	expect(document.documentElement.style.getPropertyValue('--sy-tone-color--1')).toBe(
		customColors[0]
	);
	expect(preferences.set.mock.calls).toEqual([
		['increaseContrast', true],
		['increaseContrast', false],
	]);
});

it('loads the stored preference over an old cache before revealing the app', async () => {
	preferences.get.mockReturnValue(true);
	await appearanceStore.loadSettings();
	expect(appearanceStore.increaseContrast).toBe(true);
	expect(window.localStorage.getItem('syng:appearance')).toBe('contrast');
	cleanup = appearanceStore.initialize();
	expect(document.documentElement.dataset.appearance).toBe('contrast');
});

it('isolates development appearance from production', () => {
	appearanceStore.setIncreaseContrast(true);
	cleanup = appearanceStore.initialize(true);
	expect(appearanceStore.increaseContrast).toBe(false);
	appearanceStore.setIncreaseContrast(false);
	expect(window.localStorage.getItem('syng:appearance')).toBe('contrast');
	expect(window.localStorage.getItem('syng:appearance:development')).toBe('original');
});

it('updates another window without saving back or responding to unrelated storage', () => {
	window.dispatchEvent(new StorageEvent('storage', { key: 'other', newValue: 'contrast' }));
	expect(appearanceStore.increaseContrast).toBe(false);
	window.dispatchEvent(
		new StorageEvent('storage', { key: 'syng:appearance', newValue: 'contrast' })
	);
	expect(document.documentElement.dataset.appearance).toBe('contrast');
	expect(preferences.set).not.toHaveBeenCalled();
	cleanup();
	window.dispatchEvent(
		new StorageEvent('storage', { key: 'syng:appearance', newValue: 'original' })
	);
	expect(appearanceStore.increaseContrast).toBe(true);
});

it('keeps a newer user choice if a preference load completes late', async () => {
	let finishLoading!: () => void;
	preferences.waitForInit.mockReturnValue(
		new Promise<void>((resolve) => {
			finishLoading = resolve;
		})
	);
	const pendingLoad = appearanceStore.loadSettings();
	appearanceStore.setIncreaseContrast(true);
	finishLoading();
	await pendingLoad;
	expect(appearanceStore.increaseContrast).toBe(true);
	appearanceStore.setIncreaseContrast(false);
	expect(document.documentElement.style.getPropertyValue('--sy-tone-color--1')).toBe(
		customColors[0]
	);
});

it('does not apply a delayed preference load from a previous initialization', async () => {
	let finishLoading!: () => void;
	preferences.waitForInit.mockReturnValue(
		new Promise<void>((resolve) => {
			finishLoading = resolve;
		})
	);
	preferences.get.mockReturnValue(true);
	const pendingLoad = appearanceStore.loadSettings();
	cleanup = appearanceStore.initialize(true);
	finishLoading();
	await pendingLoad;
	expect(appearanceStore.increaseContrast).toBe(false);
	expect(window.localStorage.getItem('syng:appearance:development')).toBeNull();
});

it('still applies and saves the preference when browser storage is unavailable', async () => {
	vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
		throw new Error('Storage unavailable');
	});
	vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
		throw new Error('Storage unavailable');
	});
	cleanup = appearanceStore.initialize();
	await appearanceStore.loadSettings();
	appearanceStore.setIncreaseContrast(true);
	expect(document.documentElement.dataset.appearance).toBe('contrast');
	expect(preferences.set).toHaveBeenCalledWith('increaseContrast', true);
});
