import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/svelte';
import ToneColorPicker from '@/components/SettingsOption/ToneColorPicker.svelte';
import { appearanceStore } from '@/stores/appearance.svelte.js';
import { setPreferenceManagerForTest } from '@/utils/appServices.js';
import { DEFAULT_TONE_COLOR_TOKENS } from '@/utils/tones.js';

const customColors = ['#123456', '#234567', '#345678', '#456789', '#56789a'];
let toneColors = { hasCustomColors: true, colors: [...customColors] };
const savePreference = vi.fn();

beforeEach(async () => {
	toneColors = { hasCustomColors: true, colors: [...customColors] };
	savePreference.mockClear();
	setPreferenceManagerForTest({
		waitForInit: async () => {},
		get: (name: string) => (name === 'toneColors' ? toneColors : false),
		set: savePreference,
	} as never);
	await appearanceStore.loadSettings();
	const getNativeStyle = window.getComputedStyle.bind(window);
	vi.spyOn(window, 'getComputedStyle').mockImplementation((element) => {
		if (
			element instanceof HTMLElement &&
			element.style.color.startsWith('var(--sy-tone-default--')
		) {
			return {
				color:
					document.documentElement.dataset.appearance === 'contrast'
						? 'rgb(17, 34, 51)'
						: 'rgb(68, 85, 102)',
			} as CSSStyleDeclaration;
		}
		return getNativeStyle(element);
	});
});

afterEach(() => vi.restoreAllMocks());

it('shows protected contrast tones and restores custom swatches without changing their preference', async () => {
	const onchange = vi.fn();
	const { getByLabelText, getByRole, getByText, queryByText } = render(ToneColorPicker, {
		onchange,
	});
	const firstTone = getByLabelText('First Tone') as HTMLInputElement;
	expect(firstTone.value).toBe(customColors[0]);
	appearanceStore.setIncreaseContrast(true);
	await waitFor(() => expect(firstTone.disabled).toBe(true));
	expect(firstTone.value).toBe('#112233');
	expect(
		(getByRole('button', { name: 'Reset to theme colors' }) as HTMLButtonElement).disabled
	).toBe(true);
	expect(getByText(/Turn off Increase Contrast to use custom colors/)).toBeTruthy();
	appearanceStore.setIncreaseContrast(false);
	await waitFor(() => expect(firstTone.disabled).toBe(false));
	expect(firstTone.value).toBe(customColors[0]);
	expect(
		(getByRole('button', { name: 'Reset to theme colors' }) as HTMLButtonElement).disabled
	).toBe(false);
	expect(queryByText(/Turn off Increase Contrast to use custom colors/)).toBeNull();
	expect(onchange).not.toHaveBeenCalled();
	expect(savePreference.mock.calls).toEqual([
		['increaseContrast', true],
		['increaseContrast', false],
	]);
	expect(toneColors.colors).toEqual(customColors);
});

it('refreshes default swatches in both directions when appearance changes', async () => {
	toneColors = { hasCustomColors: false, colors: [...DEFAULT_TONE_COLOR_TOKENS] };
	const { getByLabelText } = render(ToneColorPicker);
	const firstTone = getByLabelText('First Tone') as HTMLInputElement;
	expect(firstTone.value).toBe('#445566');
	appearanceStore.setIncreaseContrast(true);
	await waitFor(() => expect(firstTone.value).toBe('#112233'));
	appearanceStore.setIncreaseContrast(false);
	await waitFor(() => expect(firstTone.value).toBe('#445566'));
});
