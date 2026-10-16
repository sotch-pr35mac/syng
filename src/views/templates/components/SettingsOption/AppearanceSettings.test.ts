import { beforeEach, expect, it, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import AppearanceSettings from '@/components/SettingsOption/AppearanceSettings.svelte';
import { appearanceStore } from '@/stores/appearance.svelte.js';
import { setPreferenceManagerForTest } from '@/utils/appServices.js';

const savePreference = vi.fn();

beforeEach(async () => {
	savePreference.mockClear();
	setPreferenceManagerForTest({
		waitForInit: async () => {},
		get: () => false,
		set: savePreference,
	} as never);
	await appearanceStore.loadSettings();
});

it('names the control without extra explanation and saves keyboard and label changes immediately', async () => {
	const user = userEvent.setup();
	const { getByRole, container } = render(AppearanceSettings);
	const toggle = getByRole('checkbox', { name: 'Increase Contrast' }) as HTMLInputElement;
	expect(toggle.checked).toBe(false);
	expect(toggle.hasAttribute('aria-describedby')).toBe(false);
	expect(container.querySelector('p')).toBeNull();
	await user.tab();
	expect(document.activeElement).toBe(toggle);
	await user.keyboard(' ');
	expect(toggle.checked).toBe(true);
	expect(document.documentElement.dataset.appearance).toBe('contrast');
	expect(savePreference).toHaveBeenLastCalledWith('increaseContrast', true);
	await user.click(container.querySelector('.appearance-settings > label')!);
	expect(toggle.checked).toBe(false);
	expect(savePreference).toHaveBeenLastCalledWith('increaseContrast', false);
});

it('reflects the shared saved choice and gives separate instances unique label targets', async () => {
	appearanceStore.setIncreaseContrast(true);
	const firstView = render(AppearanceSettings);
	const secondView = render(AppearanceSettings, { variant: 'mobile' });
	const toggles = document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
	expect(toggles).toHaveLength(2);
	expect(toggles[0].checked).toBe(true);
	expect(toggles[1].checked).toBe(true);
	expect(toggles[0].id).not.toBe(toggles[1].id);
	firstView.unmount();
	secondView.unmount();
});
