import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, waitFor } from '@testing-library/svelte';
import ToneColorPicker from '@/components/SettingsOption/ToneColorPicker.svelte';
import { contrastStore } from '@/stores/contrast.svelte.js';
import { setPreferenceManagerForTest } from '@/utils/appServices.js';
import { THEME_TONE_COLOR_TOKENS } from '@/utils/tones.js';

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
	await contrastStore.loadSettings();
	const getNativeStyle = window.getComputedStyle.bind(window);
	vi.spyOn(window, 'getComputedStyle').mockImplementation((element) => {
		if (
			element instanceof HTMLElement &&
			element.style.color.startsWith('var(--sy-tone-theme--')
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

it.each(['desktop', 'mobile'] as const)(
	'keeps custom %s swatches editable across contrast changes',
	async (variant) => {
		const onchange = vi.fn();
		const { getByLabelText, getByRole, queryByText } = render(ToneColorPicker, {
			onchange,
			variant,
		});
		const firstTone = getByLabelText('First Tone') as HTMLInputElement;
		expect(firstTone.value).toBe(customColors[0]);
		contrastStore.setIncreaseContrast(true);
		await waitFor(() => expect(contrastStore.increaseContrast).toBe(true));
		expect(firstTone.disabled).toBe(false);
		expect(firstTone.value).toBe(customColors[0]);
		expect(
			(getByRole('button', { name: 'Reset to theme colors' }) as HTMLButtonElement).disabled
		).toBe(false);
		contrastStore.setIncreaseContrast(false);
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
	}
);

it.each(['desktop', 'mobile'] as const)(
	'allows editing and resetting %s tones with Increase Contrast on',
	async (variant) => {
		contrastStore.setIncreaseContrast(true);
		const onchange = vi.fn();
		const { getByLabelText, getByRole } = render(ToneColorPicker, { variant, onchange });
		const firstTone = getByLabelText('First Tone') as HTMLInputElement;
		await fireEvent.change(firstTone, { target: { value: '#ffffee' } });
		expect(onchange).toHaveBeenLastCalledWith({
			hasCustomColors: true,
			colors: ['#ffffee', ...customColors.slice(1)],
		});
		contrastStore.setIncreaseContrast(false);
		await waitFor(() => expect(firstTone.value).toBe('#ffffee'));
		contrastStore.setIncreaseContrast(true);
		const reset = getByRole('button', { name: 'Reset to theme colors' }) as HTMLButtonElement;
		expect(reset.disabled).toBe(false);
		await fireEvent.click(reset);
		expect(onchange).toHaveBeenLastCalledWith({
			hasCustomColors: false,
			colors: [...THEME_TONE_COLOR_TOKENS],
		});
		expect(firstTone.value).toBe('#112233');
		expect(reset.disabled).toBe(true);
		contrastStore.setIncreaseContrast(false);
		await waitFor(() => expect(firstTone.value).toBe('#445566'));
	}
);

it('refreshes default swatches in both directions when appearance changes', async () => {
	toneColors = { hasCustomColors: false, colors: [...THEME_TONE_COLOR_TOKENS] };
	const { getByLabelText } = render(ToneColorPicker);
	const firstTone = getByLabelText('First Tone') as HTMLInputElement;
	expect(firstTone.value).toBe('#445566');
	contrastStore.setIncreaseContrast(true);
	await waitFor(() => expect(firstTone.value).toBe('#112233'));
	contrastStore.setIncreaseContrast(false);
	await waitFor(() => expect(firstTone.value).toBe('#445566'));
});
