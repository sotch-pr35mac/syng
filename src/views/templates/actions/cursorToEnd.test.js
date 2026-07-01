import { vi } from 'vitest';

vi.mock('@/utils/device.js', () => ({
	isMobile: vi.fn(() => true),
}));

import { cursorToEnd } from '@/actions/cursorToEnd.svelte.js';
import { isMobile } from '@/utils/device.js';

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));

it('moves the caret to the end of existing text on focus (mobile)', async () => {
	const input = document.createElement('input');
	input.value = 'hello';
	document.body.appendChild(input);
	const action = cursorToEnd(input);

	input.dispatchEvent(new Event('focus'));
	await nextFrame();

	expect(input.selectionStart).toBe(5);
	expect(input.selectionEnd).toBe(5);
	action.destroy();
	input.remove();
});

it('is a no-op on desktop', async () => {
	vi.mocked(isMobile).mockReturnValueOnce(false);
	const input = document.createElement('input');
	input.value = 'hello';
	input.setSelectionRange(0, 0);
	const action = cursorToEnd(input);

	input.dispatchEvent(new Event('focus'));
	await nextFrame();

	expect(input.selectionStart).toBe(0);
	action.destroy();
});

it('does not throw for input types that reject setSelectionRange', async () => {
	const input = document.createElement('input');
	input.type = 'number';
	input.value = '123';
	const action = cursorToEnd(input);

	expect(() => input.dispatchEvent(new Event('focus'))).not.toThrow();
	await nextFrame();
	action.destroy();
});
