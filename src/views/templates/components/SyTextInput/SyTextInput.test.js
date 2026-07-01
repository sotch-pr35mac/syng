import { render } from '@testing-library/svelte';
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
