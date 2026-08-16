import { beforeEach, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import DefinitionItem from '@/components/DictionaryContent/DefinitionItem.svelte';
import { dictionaryDisplaySettingsStore } from '@/stores/dictionaryDisplaySettings.svelte.js';
import { setPreferenceManagerForTest } from '@/utils/appServices.js';

beforeEach(async () => {
	const preferences = {
		characterSet: 'both',
		colorCharactersByTone: true,
		colorPinyinByTone: false,
	};
	setPreferenceManagerForTest({
		waitForInit: vi.fn(() => Promise.resolve()),
		get: vi.fn((name) => preferences[name]),
		set: vi.fn((name, value) => {
			preferences[name] = value;
		}),
	});
	await dictionaryDisplaySettingsStore.loadSettings();
});

it('should display textual value with the correct styles', async () => {
	const { getByText } = render(DefinitionItem, {
		value: 'test',
	});

	const text = getByText('test');
	const styles = text.className.split(' ');
	expect(text.textContent).toBe('test');
	expect(styles).toContain('dictionary-content--definition-item');
});

it('renders and opens parenthetical preference-aware links in definitions', async () => {
	const user = userEvent.setup();
	const handleOpenLink = vi.fn();
	const { container, getByLabelText, getByTestId } = render(DefinitionItem, {
		value: 'numeral 9 in Suzhou numeral system 蘇州碼子|苏州码子[Su1 zhou1 ma3 zi5]',
		onevent: handleOpenLink,
	});
	const link = getByTestId('dictionary-link');
	expect(container.textContent).toContain('numeral 9 in Suzhou numeral system');
	expect(getByLabelText('Simplified Chinese: 苏州码子').textContent).toBe('苏州码子');
	expect(getByLabelText('Traditional Chinese: 蘇州碼子').textContent).toBe('蘇州碼子');
	expect(getByTestId('dictionary-link-simplified').textContent).toBe('苏州码子');
	expect(getByTestId('dictionary-link-traditional').textContent).toBe('蘇州碼子');
	expect(link.textContent).toBe('苏州码子（蘇州碼子）');
	await user.click(link);
	expect(handleOpenLink).toHaveBeenCalledWith(expect.objectContaining({ text: '蘇州碼子' }));
});

it('renders only the preferred form for definition links', () => {
	dictionaryDisplaySettingsStore.setCharacterSet('traditional');
	const { getByTestId, queryByTestId } = render(DefinitionItem, {
		value: 'see 蘇州碼子|苏州码子[Su1 zhou1 ma3 zi5]',
	});

	expect(getByTestId('dictionary-link-traditional').textContent).toBe('蘇州碼子');
	expect(queryByTestId('dictionary-link-simplified')).toBeNull();
});
