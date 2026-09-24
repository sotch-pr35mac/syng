import { render, fireEvent } from '@testing-library/svelte';
import { vi } from 'vitest';
import SyTextInput from '@/components/SyTextInput/SyTextInput.svelte';

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

it('waits for committed IME input and does not submit the composition-confirming Enter', async () => {
	const oninput = vi.fn();
	const onenter = vi.fn();
	const { container } = render(SyTextInput, { id: 'ime-input', oninput, onenter });
	const input = container.querySelector('input');
	await fireEvent.compositionStart(input);
	await fireEvent.input(input, { target: { value: 'ni' }, isComposing: true });
	await fireEvent.keyDown(input, { code: 'Enter', isComposing: true });
	expect(oninput).not.toHaveBeenCalled();
	input.value = '你';
	await fireEvent.compositionEnd(input);
	await fireEvent.keyUp(input, { code: 'Enter' });
	expect(oninput).toHaveBeenCalledExactlyOnceWith('你');
	expect(onenter).not.toHaveBeenCalled();
	await fireEvent.keyDown(input, { code: 'Enter' });
	await fireEvent.keyUp(input, { code: 'Enter' });
	expect(onenter).toHaveBeenCalledTimes(1);
});
