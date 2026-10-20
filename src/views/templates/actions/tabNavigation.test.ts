import { fireEvent } from '@testing-library/svelte';
import { afterEach, expect, it, vi } from 'vitest';
import { tabNavigation } from '@/actions/tabNavigation.js';

const cleanups: Array<() => void> = [];

afterEach(() => {
	for (const cleanup of cleanups.splice(0)) {
		cleanup();
	}
});

function createTablist(labels: string[]) {
	const tablist = document.createElement('div');
	tablist.setAttribute('role', 'tablist');
	const tabs = labels.map((label, index) => {
		const tab = document.createElement('button');
		tab.type = 'button';
		tab.setAttribute('role', 'tab');
		tab.textContent = label;
		tab.setAttribute('aria-selected', String(index === 0));
		tablist.appendChild(tab);
		return tab;
	});
	for (const selectedTab of tabs) {
		selectedTab.addEventListener('click', () => {
			for (const tab of tabs) {
				tab.setAttribute('aria-selected', String(tab === selectedTab));
			}
		});
	}
	document.body.appendChild(tablist);
	const action = tabNavigation(tablist);
	cleanups.push(() => {
		if (action) {
			action.destroy?.();
		}
		tablist.remove();
	});
	return { tablist, tabs, action };
}

it('moves and activates with arrows, wraps, and supports Home and End', async () => {
	const { tabs } = createTablist(['General', 'Telemetry', 'Acknowledgements']);
	const [general, telemetry, acknowledgements] = tabs;
	general.focus();
	expect(tabs.map((tab) => tab.tabIndex)).toEqual([0, -1, -1]);

	await fireEvent.keyDown(general, { key: 'ArrowRight' });
	expect(document.activeElement).toBe(telemetry);
	expect(telemetry.getAttribute('aria-selected')).toBe('true');
	expect(tabs.map((tab) => tab.tabIndex)).toEqual([-1, 0, -1]);
	await fireEvent.keyDown(telemetry, { key: 'End' });
	expect(document.activeElement).toBe(acknowledgements);
	await fireEvent.keyDown(acknowledgements, { key: 'ArrowRight' });
	expect(document.activeElement).toBe(general);
	await fireEvent.keyDown(general, { key: 'ArrowLeft' });
	expect(document.activeElement).toBe(acknowledgements);
	await fireEvent.keyDown(acknowledgements, { key: 'Home' });
	expect(document.activeElement).toBe(general);
});

it('skips disabled and hidden tabs, including when the selected tab becomes unavailable', async () => {
	const { tabs } = createTablist(['General', 'Unavailable', 'Hidden', 'Help']);
	const [general, unavailable, hidden, help] = tabs;
	unavailable.disabled = true;
	hidden.hidden = true;
	general.focus();

	await fireEvent.keyDown(general, { key: 'ArrowRight' });
	expect(document.activeElement).toBe(help);
	expect(unavailable.tabIndex).toBe(-1);
	expect(hidden.tabIndex).toBe(-1);
	help.setAttribute('aria-disabled', 'true');
	await Promise.resolve();
	expect(general.tabIndex).toBe(0);
	expect(help.tabIndex).toBe(-1);
});

it('responds to selected-state updates without requiring keyboard input', async () => {
	const { tabs } = createTablist(['Search', 'Bookmarks']);
	const [search, bookmarks] = tabs;

	search.setAttribute('aria-selected', 'false');
	bookmarks.setAttribute('aria-selected', 'true');
	await Promise.resolve();
	expect(search.tabIndex).toBe(-1);
	expect(bookmarks.tabIndex).toBe(0);
});

it('does not consume Tab, typing, modified arrows, or perpendicular arrows', async () => {
	const { tabs } = createTablist(['General', 'Help']);
	const [general] = tabs;
	const clicked = vi.fn();
	general.addEventListener('click', clicked);
	general.focus();

	for (const key of ['Tab', 'x', 'ArrowDown']) {
		const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
		general.dispatchEvent(event);
		expect(event.defaultPrevented).toBe(false);
	}
	await fireEvent.keyDown(general, { key: 'ArrowRight', ctrlKey: true });
	expect(document.activeElement).toBe(general);
	expect(clicked).not.toHaveBeenCalled();
});

it('adapts arrow directions to vertical tablists and right-to-left horizontal tablists', async () => {
	const { tablist, tabs } = createTablist(['First', 'Second', 'Third']);
	const [first, second, third] = tabs;
	tablist.setAttribute('aria-orientation', 'vertical');
	first.focus();
	await fireEvent.keyDown(first, { key: 'ArrowDown' });
	expect(document.activeElement).toBe(second);

	tablist.setAttribute('aria-orientation', 'horizontal');
	tablist.style.direction = 'rtl';
	await fireEvent.keyDown(second, { key: 'ArrowLeft' });
	expect(document.activeElement).toBe(third);
});

it('does not move focus or select a tab in a nested tablist', async () => {
	const outer = createTablist(['Outer first', 'Outer second']);
	const inner = createTablist(['Inner first', 'Inner second']);
	outer.tablist.appendChild(inner.tablist);
	const [innerFirst, innerSecond] = inner.tabs;
	innerFirst.focus();

	await fireEvent.keyDown(innerFirst, { key: 'ArrowRight' });
	expect(document.activeElement).toBe(innerSecond);
	expect(outer.tabs[0].getAttribute('aria-selected')).toBe('true');
	expect(innerSecond.tabIndex).toBe(0);
});

it('removes event handling when the tablist is destroyed', async () => {
	const { tabs, action } = createTablist(['First', 'Second']);
	const [first] = tabs;
	first.focus();
	if (action) {
		action.destroy?.();
	}

	await fireEvent.keyDown(first, { key: 'ArrowRight' });
	expect(document.activeElement).toBe(first);
});
