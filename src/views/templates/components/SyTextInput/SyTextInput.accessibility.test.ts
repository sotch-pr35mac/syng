import { fireEvent, render } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import SyTextInput from '@/components/SyTextInput/SyTextInput.svelte';

it('forwards native accessible names and validation attributes with native description precedence', () => {
	const { getByRole } = render(SyTextInput, {
		'aria-label': 'Search dictionary',
		'aria-describedby': 'search-help',
		'aria-invalid': true,
		'aria-errormessage': 'search-error',
		ariaDescribedby: 'legacy-help',
		name: 'query',
		required: true,
		class: 'search-input',
	});
	const input = getByRole('textbox', { name: 'Search dictionary' }) as HTMLInputElement;

	expect(input.getAttribute('aria-describedby')).toBe('search-help');
	expect(input.getAttribute('aria-invalid')).toBe('true');
	expect(input.getAttribute('aria-errormessage')).toBe('search-error');
	expect(input.name).toBe('query');
	expect(input.required).toBe(true);
	expect(input.classList).toContain('search-input');
	expect(input.classList).toContain('sy-text-input');
});

it('forwards native focus and keydown callbacks without changing string input callbacks', async () => {
	const user = userEvent.setup();
	const onfocus = vi.fn();
	const onblur = vi.fn();
	const onkeydown = vi.fn();
	const oninput = vi.fn();
	const { getByRole } = render(SyTextInput, {
		'aria-label': 'List name',
		onfocus,
		onblur,
		onkeydown,
		oninput,
	});
	const input = getByRole('textbox', { name: 'List name' });

	await user.tab();
	expect(document.activeElement).toBe(input);
	expect(onfocus).toHaveBeenCalledOnce();
	await user.keyboard('水');
	expect(onkeydown).toHaveBeenCalled();
	expect(oninput).toHaveBeenLastCalledWith('水');
	await user.tab();
	expect(onblur).toHaveBeenCalledOnce();
});

it('forwards composition callbacks while retaining committed-input and Enter suppression', async () => {
	const oncompositionstart = vi.fn();
	const oncompositionend = vi.fn();
	const oninput = vi.fn();
	const onenter = vi.fn();
	const { getByRole } = render(SyTextInput, {
		'aria-label': 'Chinese search',
		oncompositionstart,
		oncompositionend,
		oninput,
		onenter,
	});
	const input = getByRole('textbox', { name: 'Chinese search' }) as HTMLInputElement;

	await fireEvent.compositionStart(input);
	await fireEvent.input(input, { target: { value: 'ni' }, isComposing: true });
	expect(oninput).not.toHaveBeenCalled();
	input.value = '你';
	await fireEvent.compositionEnd(input);
	await fireEvent.keyUp(input, { key: 'Enter' });
	expect(oncompositionstart).toHaveBeenCalledOnce();
	expect(oncompositionend).toHaveBeenCalledOnce();
	expect(oninput).toHaveBeenCalledExactlyOnceWith('你');
	expect(onenter).not.toHaveBeenCalled();
});

it('keeps a disabled field out of keyboard navigation', async () => {
	const user = userEvent.setup();
	const { getByRole } = render(SyTextInput, {
		'aria-label': 'Unavailable field',
		disabled: true,
	});
	const input = getByRole('textbox', { name: 'Unavailable field' }) as HTMLInputElement;

	await user.tab();
	expect(input.disabled).toBe(true);
	expect(document.activeElement).not.toBe(input);
});
