import { afterEach, describe, expect, it, vi } from 'vitest';
import { initializeAccessibility } from '@/composables/accessibility.js';

let cleanup: (() => void) | undefined;
afterEach(() => {
	cleanup?.();
	document.body.innerHTML = '';
	vi.unstubAllGlobals();
});

describe('adaptive focus compatibility', () => {
	it('provides a fallback only when native focus-visible is missing', () => {
		vi.stubGlobal('CSS', { supports: () => false });
		document.body.innerHTML =
			'<button>First</button><button>Second</button><input aria-label="Search">';
		cleanup = initializeAccessibility();
		const [first, second] = document.querySelectorAll('button');
		first.focus();
		expect(first.classList.contains('sy-focus-visible')).toBe(true);
		document.dispatchEvent(new Event('pointerdown', { bubbles: true }));
		second.focus();
		expect(second.classList.contains('sy-focus-visible')).toBe(false);
		document.querySelector('input')!.focus();
		expect(document.querySelector('input')!.classList.contains('sy-focus-visible')).toBe(true);
		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
		first.focus();
		expect(first.classList.contains('sy-focus-visible')).toBe(true);
	});

	it('leaves modern browser focus heuristics intact and dismisses keyboard tooltips', () => {
		vi.stubGlobal('CSS', { supports: () => true });
		document.body.innerHTML =
			'<button class="sy-tooltip--container">Help<span class="sy-tooltip--body">Details</span></button>';
		cleanup = initializeAccessibility();
		const button = document.querySelector('button')!;
		button.focus();
		expect(button.classList.contains('sy-focus-visible')).toBe(false);
		expect(button.classList.contains('sy-tooltip--keyboard-focus')).toBe(true);
		button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		expect(button.classList.contains('sy-tooltip--dismissed')).toBe(true);
	});
});
