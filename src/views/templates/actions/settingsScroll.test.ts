import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { settingsScroll } from '@/actions/settingsScroll.js';
import { settingsScrollStore } from '@/stores/settings.svelte.js';

const tour = vi.hoisted(() => ({
	phase: 'idle',
	step: undefined as { target: string } | undefined,
}));
vi.mock('@/stores/walkthrough.svelte.js', () => ({
	walkthroughStore: tour,
}));

beforeEach(() => {
	settingsScrollStore.resetForTest();
	vi.useFakeTimers();
	tour.phase = 'idle';
	tour.step = undefined;
});
afterEach(() => vi.useRealTimers());

it('waits for conditional rows before restoring without taking focus', () => {
	settingsScrollStore.set('desktop', 'general', 480);
	const node = document.createElement('div');
	const focus = vi.spyOn(node, 'focus');
	const action = settingsScroll(node, { layout: 'desktop', tab: 'general', ready: false });
	vi.runAllTimers();
	expect(node.scrollTop).toBe(0);
	action.update({ layout: 'desktop', tab: 'general', ready: true });
	vi.runAllTimers();
	expect(node.scrollTop).toBe(480);
	expect(focus).not.toHaveBeenCalled();
	action.destroy();
});

it.each(['wheel', 'touchstart', 'pointerdown', 'keydown', 'scroll'])(
	'yields pending restoration to %s',
	(eventName) => {
		settingsScrollStore.set('mobile', 'general', 480);
		const node = document.createElement('div');
		const action = settingsScroll(node, { layout: 'mobile', tab: 'general', ready: false });
		node.scrollTop = 90;
		node.dispatchEvent(new Event(eventName));
		action.update({ layout: 'mobile', tab: 'general', ready: true });
		vi.runAllTimers();
		expect(node.scrollTop).toBe(90);
		action.destroy();
		expect(settingsScrollStore.get('mobile', 'general')).toBe(90);
	}
);

it('keeps an earlier position when leaving before delayed options resolve', () => {
	settingsScrollStore.set('mobile', 'general', 480);
	const action = settingsScroll(document.createElement('div'), {
		layout: 'mobile',
		tab: 'general',
		ready: false,
	});
	action.destroy();
	vi.runAllTimers();
	expect(settingsScrollStore.get('mobile', 'general')).toBe(480);
});

it('retains the observed position when tab teardown clamps the detached container', () => {
	const node = document.createElement('div');
	const action = settingsScroll(node, { layout: 'mobile', tab: 'general', ready: true });
	node.scrollTop = 500;
	node.dispatchEvent(new Event('scroll'));
	node.scrollTop = 0;
	action.destroy();
	expect(settingsScrollStore.get('mobile', 'general')).toBe(500);
});

it('retries a clamped position when asynchronously loaded content grows', () => {
	let notifyResize: () => void = () => {};
	vi.stubGlobal(
		'ResizeObserver',
		class {
			constructor(callback: () => void) {
				notifyResize = callback;
			}
			observe() {}
			disconnect() {}
		}
	);
	settingsScrollStore.set('desktop', 'acknowledgements', 500);
	const node = document.createElement('div');
	let maxScroll = 0;
	let position = 0;
	Object.defineProperty(node, 'scrollTop', {
		get: () => position,
		set: (next: number) => {
			position = Math.min(next, maxScroll);
		},
	});
	const action = settingsScroll(node, {
		layout: 'desktop',
		tab: 'acknowledgements',
		ready: true,
	});
	vi.runAllTimers();
	expect(node.scrollTop).toBe(0);
	node.dispatchEvent(new Event('scroll'));
	maxScroll = 900;
	notifyResize();
	vi.runAllTimers();
	expect(node.scrollTop).toBe(500);
	action.destroy();
	vi.unstubAllGlobals();
});

it('keeps tab and layout positions independent', () => {
	for (const [layout, tab, position] of [
		['mobile', 'general', 200],
		['desktop', 'general', 400],
		['desktop', 'telemetry', 600],
	] as const) {
		const node = document.createElement('div');
		const action = settingsScroll(node, { layout, tab, ready: true });
		node.scrollTop = position;
		node.dispatchEvent(new Event('scroll'));
		action.destroy();
	}
	expect(settingsScrollStore.get('mobile', 'general')).toBe(200);
	expect(settingsScrollStore.get('desktop', 'general')).toBe(400);
	expect(settingsScrollStore.get('desktop', 'telemetry')).toBe(600);
});

it('does not move a revealed walkthrough target back to the previous section', () => {
	settingsScrollStore.set('desktop', 'general', 480);
	tour.phase = 'guiding';
	tour.step = { target: 'settings-walkthroughs' };
	const node = document.createElement('div');
	const action = settingsScroll(node, { layout: 'desktop', tab: 'general', ready: true });
	vi.runAllTimers();
	expect(node.scrollTop).toBe(0);
	action.destroy();
});
