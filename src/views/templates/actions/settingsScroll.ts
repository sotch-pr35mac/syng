import {
	settingsScrollStore,
	type SettingsLayout,
	type SettingsTab,
} from '@/stores/settings.svelte.js';
import { walkthroughStore } from '@/stores/walkthrough.svelte.js';

interface SettingsScrollOptions {
	layout: SettingsLayout;
	tab: SettingsTab;
	ready: boolean;
}

/** Each tab owns a keyed scroll container. Wait for General's conditional rows before restoring. */
export function settingsScroll(node: HTMLElement, initialOptions: SettingsScrollOptions) {
	let options = initialOptions;
	const { layout, tab } = initialOptions;
	const savedPosition = settingsScrollStore.get(layout, tab);
	let pending = savedPosition !== undefined;
	let frame: number | undefined;
	let lastPosition = node.scrollTop;
	let appliedPosition: number | undefined;
	const observer =
		typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(scheduleRestore);

	function remember(): void {
		lastPosition = node.scrollTop;
		settingsScrollStore.set(layout, tab, lastPosition);
	}

	function cancelRestore(): void {
		pending = false;
		observer?.disconnect();
		if (frame !== undefined) {
			cancelAnimationFrame(frame);
			frame = undefined;
		}
	}

	function onScroll(): void {
		if (pending && node.scrollTop === appliedPosition) {
			return;
		}
		// This also yields to explicit programmatic navigation, including the app tour.
		cancelRestore();
		remember();
	}

	function onInteraction(): void {
		cancelRestore();
		remember();
	}

	function scheduleRestore(): void {
		if (!pending || !options.ready || frame !== undefined) {
			return;
		}
		frame = requestAnimationFrame(() => {
			frame = undefined;
			if (
				!pending ||
				(walkthroughStore.phase === 'guiding' &&
					walkthroughStore.step?.target === 'settings-walkthroughs')
			) {
				cancelRestore();
				return;
			}
			node.scrollTop = savedPosition ?? 0;
			appliedPosition = node.scrollTop;
			// Telemetry/acknowledgements can grow after mount. Retry on content resize
			// if the browser clamped the saved position before that content arrived.
			if (appliedPosition >= (savedPosition ?? 0)) {
				pending = false;
				observer?.disconnect();
				remember();
			}
		});
	}

	if (pending) {
		observer?.observe(node);
		if (node.firstElementChild) {
			observer?.observe(node.firstElementChild);
		}
	}
	node.addEventListener('scroll', onScroll, { passive: true });
	for (const eventName of ['wheel', 'touchstart', 'pointerdown', 'keydown']) {
		node.addEventListener(eventName, onInteraction, { passive: true });
	}
	scheduleRestore();

	return {
		update(nextOptions: SettingsScrollOptions): void {
			options = nextOptions;
			scheduleRestore();
		},
		destroy(): void {
			// A quick departure before readiness must not replace the saved position with zero.
			if (!pending) {
				// Svelte can remove the tab's children before destroying this action.
				// Their removal clamps the DOM scrollTop; retain the last observed position.
				settingsScrollStore.set(layout, tab, lastPosition);
			}
			cancelRestore();
			node.removeEventListener('scroll', onScroll);
			for (const eventName of ['wheel', 'touchstart', 'pointerdown', 'keydown']) {
				node.removeEventListener(eventName, onInteraction);
			}
		},
	};
}
