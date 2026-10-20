/**
 * Provide content-width layout switches on older WebKit without container queries.
 * Breakpoints use the current root font size so system text scaling can select the
 * compact layout even when the window width itself has not changed.
 */
import { subscribeSystemTypography } from '@/composables/systemTypography.js';

type ResponsiveLayoutOptions = { thresholdRem: number; className: string };
const DEFAULT_ROOT_FONT_SIZE = 16;

/** Toggle className below thresholdRem, observing width/text-size changes until destroyed. */
export function responsiveLayout(element: HTMLElement, initialOptions: ResponsiveLayoutOptions) {
	let options = initialOptions;
	/** Compare the rendered content width with the breakpoint expressed in current rem units. */
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
