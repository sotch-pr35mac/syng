import { render, fireEvent } from '@testing-library/svelte';
import { beforeEach, vi } from 'vitest';
import SyTextInput from '@/components/SyTextInput/SyTextInput.svelte';
import { isAndroid } from '@/utils/device.js';

vi.mock('@/utils/device.js', () => ({
	isMobile: () => true,
	isAndroid: vi.fn(() => false),
}));

beforeEach(() => {
	vi.mocked(isAndroid).mockReturnValue(false);
});

it('disables autocorrect, autocapitalize and spellcheck by default', () => {
	const { container } = render(SyTextInput, { id: 'test-input' });
	const input = container.querySelector('input');
	expect(input.getAttribute('autocorrect')).toBe('off');
	expect(input.getAttribute('autocapitalize')).toBe('off');
	expect(input.getAttribute('spellcheck')).toBe('false');
});

it('allows autocorrect to be opted back in', () => {
	const { container } = render(SyTextInput, {
		id: 'test-input',
		autocorrect: 'on',
		autocapitalize: 'sentences',
		spellcheck: true,
	});
	const input = container.querySelector('input');
	expect(input.getAttribute('autocorrect')).toBe('on');
	expect(input.getAttribute('autocapitalize')).toBe('sentences');
	expect(input.getAttribute('spellcheck')).toBe('true');
});

it('forwards form validation and descriptive attributes', () => {
	const { container } = render(SyTextInput, {
		id: 'signup-name',
		name: 'preferred-name',
		required: true,
		ariaDescribedby: 'signup-name-help',
	});
	const input = container.querySelector('input');
	expect(input.getAttribute('name')).toBe('preferred-name');
	expect(input.required).toBe(true);
	expect(input.getAttribute('aria-describedby')).toBe('signup-name-help');
});

it('waits for committed IME input and does not submit the composition-confirming Enter', async () => {
	vi.mocked(isAndroid).mockReturnValue(true);
	const oninput = vi.fn();
	const onenter = vi.fn();
	const { container } = render(SyTextInput, { id: 'ime-input', oninput, onenter });
	const input = container.querySelector('input');
	input.focus();
	await fireEvent.compositionStart(input);
	await fireEvent.input(input, { target: { value: 'ni' }, isComposing: true });
	await fireEvent.keyDown(input, { code: 'Enter', isComposing: true });
	expect(oninput).not.toHaveBeenCalled();
	input.value = '你';
	await fireEvent.compositionEnd(input);
	await fireEvent.keyUp(input, { code: 'Enter' });
	expect(oninput).toHaveBeenCalledExactlyOnceWith('你');
	expect(onenter).not.toHaveBeenCalled();
	expect(document.activeElement).toBe(input);
	await fireEvent.keyDown(input, { code: 'Enter' });
	await fireEvent.keyUp(input, { code: 'Enter' });
	expect(onenter).toHaveBeenCalledTimes(1);
	expect(document.activeElement).not.toBe(input);
});

it('dismisses the Android keyboard on Enter before invoking the callback', async () => {
	vi.mocked(isAndroid).mockReturnValue(true);
	const onenter = vi.fn(() => expect(document.activeElement).not.toBe(input));
	const { container } = render(SyTextInput, { onenter });
	const input = container.querySelector('input');
	input.focus();

	await fireEvent.keyUp(input, { key: 'Enter', code: 'Unidentified' });

	expect(onenter).toHaveBeenCalledOnce();
	expect(document.activeElement).not.toBe(input);
});

it('dismisses Android fields without an Enter callback and leaves desktop focus alone', async () => {
	vi.mocked(isAndroid).mockReturnValue(true);
	const androidInput = render(SyTextInput).container.querySelector('input');
	androidInput.focus();
	await fireEvent.keyUp(androidInput, { keyCode: 13 });
	expect(document.activeElement).not.toBe(androidInput);

	vi.mocked(isAndroid).mockReturnValue(false);
	const desktopInput = render(SyTextInput).container.querySelector('input');
	desktopInput.focus();
	await fireEvent.keyUp(desktopInput, { key: 'Enter' });
	expect(document.activeElement).toBe(desktopInput);
});

it('ignores the legacy IME key code even when isComposing is false', async () => {
	const onenter = vi.fn();
	const onkeyup = vi.fn();
	const { container } = render(SyTextInput, { id: 'ime-fallback', onenter, onkeyup });
	const input = container.querySelector('input');
	await fireEvent.keyUp(input, { code: 'Enter', keyCode: 229, isComposing: false });
	expect(onenter).not.toHaveBeenCalled();
	expect(onkeyup).not.toHaveBeenCalled();
});

it('keeps input, change and non-Enter keyup callbacks available to other consumers', async () => {
	const oninput = vi.fn();
	const onchange = vi.fn();
	const onkeyup = vi.fn();
	const { container } = render(SyTextInput, {
		id: 'legacy-events',
		oninput,
		onchange,
		onkeyup,
	});
	const input = container.querySelector('input');
	await fireEvent.input(input, { target: { value: 'water' } });
	await fireEvent.keyUp(input, { code: 'KeyR' });
	await fireEvent.change(input);
	expect(oninput).toHaveBeenCalledExactlyOnceWith('water');
	expect(onkeyup).toHaveBeenCalledExactlyOnceWith('water');
	expect(onchange).toHaveBeenCalledExactlyOnceWith('water');
});
