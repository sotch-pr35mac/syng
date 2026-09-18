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
	expect(container.textContent).not.toContain('[Su1 zhou1 ma3 zi5]');
	await user.click(link);
	expect(handleOpenLink).toHaveBeenCalledWith(expect.objectContaining({ text: '蘇州碼子' }));
});

it('renders only the preferred form for definition links', () => {
	dictionaryDisplaySettingsStore.setCharacterSet('traditional');
	const { container, getByTestId, queryByTestId } = render(DefinitionItem, {
		value: 'see 蘇州碼子|苏州码子[Su1 zhou1 ma3 zi5]',
	});

	expect(getByTestId('dictionary-link-traditional').textContent).toBe('蘇州碼子');
	expect(queryByTestId('dictionary-link-simplified')).toBeNull();
	expect(container.textContent).not.toContain('[Su1 zhou1 ma3 zi5]');
});

it('omits a complete Wiktionary annotation immediately after a Han link', () => {
	const { container, getByTestId } = render(DefinitionItem, {
		value: 'variant of 著[kao3]',
	});

	expect(getByTestId('dictionary-link').textContent.trim()).toBe('著');
	expect(container.textContent).toContain('variant of');
	expect(container.textContent).toContain('著');
	expect(container.textContent).not.toContain('[kao3]');
});

it('keeps unrelated and malformed bracket prose in definitions', () => {
	const { container } = render(DefinitionItem, {
		value: '[kao3] 著; 著[kao3',
	});

	expect(container.textContent).toContain('[kao3]');
	expect(container.textContent).toContain('著[kao3');
});

it('links every Han segment while leaving Latin glossary terms as prose', () => {
	const { container, getAllByTestId } = render(DefinitionItem, {
		value: 'T and YYDS: see 考試|考试, then 細菌.',
	});

	const links = getAllByTestId('dictionary-link');
	expect(links).toHaveLength(2);
	expect(links[0].textContent.trim()).toBe('考试（考試）');
	expect(links[1].textContent.trim()).toBe('細菌');
	expect(container.textContent).toContain('T and YYDS: see ');
	expect(container.textContent).toContain(', then ');
});

it('opens a Han-only definition segment with a Chinese-text lookup', async () => {
	const user = userEvent.setup();
	const handleOpenLink = vi.fn();
	const { getByTestId } = render(DefinitionItem, {
		value: 'alternative form of 菌',
		onevent: handleOpenLink,
	});

	await user.click(getByTestId('dictionary-link'));
	const lookup = handleOpenLink.mock.calls[0][0];
	expect(lookup).toEqual(expect.objectContaining({ text: '菌' }));
	expect(lookup).not.toHaveProperty('lexicalId');
});
