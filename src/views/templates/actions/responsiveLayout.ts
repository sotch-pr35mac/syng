import { subscribeSystemTypography } from '@/composables/systemTypography.js';

type ResponsiveLayoutOptions = { thresholdRem: number; className: string };
const DEFAULT_ROOT_FONT_SIZE = 16;

/** Content-width breakpoints that also respond to system text size on older WebKit. */
export function responsiveLayout(element: HTMLElement, initialOptions: ResponsiveLayoutOptions) {
	let options = initialOptions;
	const updateLayout = () => {
		const rootFontSize =
			Number.parseFloat(getComputedStyle(document.documentElement).fontSize) ||
			DEFAULT_ROOT_FONT_SIZE;
		const width = element.getBoundingClientRect().width;
		// Detached and hidden views have no meaningful width yet.
		if (width > 0) {
			element.classList.toggle(
				options.className,
				width < options.thresholdRem * rootFontSize
			);
		}
	};
	const observer =
		typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(updateLayout);
	observer?.observe(element);
	const unsubscribe = subscribeSystemTypography(updateLayout);
	window.addEventListener('resize', updateLayout);
	updateLayout();
	return {
		update(nextOptions: ResponsiveLayoutOptions) {
			if (nextOptions.className !== options.className) {
				element.classList.remove(options.className);
			}
			options = nextOptions;
			updateLayout();
		},
		destroy() {
			observer?.disconnect();
			unsubscribe();
			window.removeEventListener('resize', updateLayout);
			element.classList.remove(options.className);
		},
	};
}
