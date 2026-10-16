import { afterEach, describe, expect, it } from 'vitest';
import { tick } from 'svelte';
import { routeAccessibility } from '@/actions/routeAccessibility.js';

afterEach(() => {
	document.body.innerHTML = '';
	delete document.documentElement.dataset.inputModality;
	document.title = '';
});

function createDestination() {
	document.body.innerHTML =
		'<nav><a href="#/settings">Settings</a></nav><main tabindex="-1"><input aria-label="Search"></main>';
	const main = document.querySelector('main')!;
	return { main, action: routeAccessibility(main, '/'), link: document.querySelector('a')! };
}

describe('SPA destination accessibility', () => {
	it('moves keyboard navigation from the sidebar into the named destination', async () => {
		const { main, action, link } = createDestination();
		document.documentElement.dataset.inputModality = 'keyboard';
		link.focus();
		action.update('/settings');
		await tick();
		expect(document.activeElement).toBe(main);
		expect(main.getAttribute('aria-label')).toBe('Settings');
		expect(document.title).toBe('Settings — Syng');
	});

	it('preserves pointer navigation and deliberate destination focus', async () => {
		const { action, link } = createDestination();
		document.documentElement.dataset.inputModality = 'pointer';
		link.focus();
		action.update('/settings');
		await tick();
		expect(document.activeElement).toBe(link);
		document.documentElement.dataset.inputModality = 'keyboard';
		const input = document.querySelector('input')!;
		input.focus();
		action.update('/');
		await tick();
		expect(document.activeElement).toBe(input);
	});
});
