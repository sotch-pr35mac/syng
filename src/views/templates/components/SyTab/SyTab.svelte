<script module lang="ts">
	type IndicatorGeometry = { left: number; top: number; width: number };
	type TabState = { active: boolean; variant: 'default' | 'mobile' };
	type TabGroup = {
		parent: HTMLElement;
		indicator: HTMLSpanElement;
		tabs: Map<HTMLButtonElement, TabState>;
		activeButton: HTMLButtonElement | null;
		animation: Animation | null;
		frame: number;
		animateNext: boolean;
		observer: ResizeObserver | null;
		reducedMotion: MediaQueryList | null;
		onMotionChange: () => void;
		originalPosition: string;
		changedPosition: boolean;
	};

	const tabGroups = new WeakMap<HTMLElement, TabGroup>();
	const POSITION_TOLERANCE = 0.5;
	const ROW_TOLERANCE = 3;

	function measureIndicator(
		group: TabGroup,
		button: HTMLButtonElement,
		variant: TabState['variant']
	): IndicatorGeometry {
		const parentRect = group.parent.getBoundingClientRect();
		const buttonRect = button.getBoundingClientRect();
		let left = buttonRect.left;
		let width = buttonRect.width;
		let top = buttonRect.bottom - 2;
		if (variant === 'mobile') {
			const labelRange = document.createRange();
			labelRange.selectNodeContents(button);
			const labelRect = labelRange.getBoundingClientRect?.();
			if (labelRect && labelRect.width > 0) {
				left = labelRect.left;
				width = labelRect.width;
				top = labelRect.bottom + 1;
			}
		}
		return {
			left: left - parentRect.left + group.parent.scrollLeft,
			top: top - parentRect.top + group.parent.scrollTop,
			width,
		};
	}

	function paintIndicator(group: TabGroup): void {
		const selected = [...group.tabs].find(([, state]) => state.active);
		if (!selected) {
			group.animation?.cancel();
			group.animation = null;
			group.activeButton = null;
			group.indicator.style.opacity = '0';
			return;
		}

		const [button, state] = selected;
		const target = measureIndicator(group, button, state.variant);
		const indicator = group.indicator;
		if (
			group.activeButton === button &&
			(!group.reducedMotion?.matches || !group.animation) &&
			Math.abs(Number.parseFloat(indicator.style.left) - target.left) < POSITION_TOLERANCE &&
			Math.abs(Number.parseFloat(indicator.style.top) - target.top) < POSITION_TOLERANCE &&
			Math.abs(Number.parseFloat(indicator.style.width) - target.width) < POSITION_TOLERANCE
		) {
			group.animateNext = false;
			return;
		}
		const currentStyle = getComputedStyle(indicator);
		const start = {
			left: Number.parseFloat(currentStyle.left),
			top: Number.parseFloat(currentStyle.top),
			width: Number.parseFloat(currentStyle.width),
		};
		const canAnimate =
			group.animateNext &&
			group.activeButton !== null &&
			group.activeButton !== button &&
			!group.reducedMotion?.matches &&
			Number.isFinite(start.left) &&
			Number.isFinite(start.top) &&
			Number.isFinite(start.width) &&
			Math.abs(start.top - target.top) < ROW_TOLERANCE;
		group.animation?.cancel();
		group.animation = null;
		indicator.style.left = `${target.left}px`;
		indicator.style.top = `${target.top}px`;
		indicator.style.width = `${target.width}px`;
		indicator.style.height = state.variant === 'mobile' ? '1px' : '2px';
		indicator.style.opacity = '1';
		group.activeButton = button;
		group.animateNext = false;

		if (!canAnimate || typeof indicator.animate !== 'function') {
			return;
		}
		group.animation = indicator.animate(
			[
				{ left: `${start.left}px`, width: `${start.width}px` },
				{ left: `${target.left}px`, width: `${target.width}px` },
			],
			{ duration: 240, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
		);
		group.animation.onfinish = () => {
			group.animation = null;
		};
	}

	function scheduleIndicator(group: TabGroup, animate: boolean): void {
		group.animateNext ||= animate;
		cancelAnimationFrame(group.frame);
		group.frame = requestAnimationFrame(() => {
			group.frame = 0;
			paintIndicator(group);
		});
	}

	function coordinateUnderline(button: HTMLButtonElement, state: TabState) {
		const parent = button.parentElement;
		if (!parent) {
			return {};
		}
		let group = tabGroups.get(parent);
		if (!group) {
			const indicator = document.createElement('span');
			indicator.className = 'sy-tab__indicator';
			indicator.setAttribute('aria-hidden', 'true');
			parent.append(indicator);
			const originalPosition = parent.style.position;
			const changedPosition = getComputedStyle(parent).position === 'static';
			if (changedPosition) {
				parent.style.position = 'relative';
			}
			parent.classList.add('sy-tab--motion');
			group = {
				parent,
				indicator,
				tabs: new Map(),
				activeButton: null,
				animation: null,
				frame: 0,
				animateNext: false,
				observer: null,
				reducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)') ?? null,
				onMotionChange: () => {},
				originalPosition,
				changedPosition,
			};
			group.onMotionChange = () => scheduleIndicator(group!, false);
			group.reducedMotion?.addEventListener('change', group.onMotionChange);
			if (typeof ResizeObserver !== 'undefined') {
				group.observer = new ResizeObserver(() => scheduleIndicator(group!, false));
				group.observer.observe(parent);
			}
			tabGroups.set(parent, group);
		}
		group.tabs.set(button, state);
		group.observer?.observe(button);
		scheduleIndicator(group, false);

		return {
			update(nextState: TabState) {
				const previous = group!.tabs.get(button);
				group!.tabs.set(button, nextState);
				if (
					previous?.active !== nextState.active ||
					previous?.variant !== nextState.variant
				) {
					scheduleIndicator(group!, true);
				}
			},
			destroy() {
				group!.observer?.unobserve(button);
				group!.tabs.delete(button);
				if (group!.tabs.size) {
					scheduleIndicator(group!, false);
					return;
				}
				cancelAnimationFrame(group!.frame);
				group!.animation?.cancel();
				group!.observer?.disconnect();
				group!.reducedMotion?.removeEventListener('change', group!.onMotionChange);
				group!.indicator.remove();
				parent.classList.remove('sy-tab--motion');
				if (group!.changedPosition) {
					parent.style.position = group!.originalPosition;
				}
				tabGroups.delete(parent);
			},
		};
	}
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	interface Props extends Omit<HTMLButtonAttributes, 'children'> {
		active?: boolean;
		variant?: 'default' | 'mobile';
		children?: Snippet;
	}

	const {
		active = false,
		variant = 'default',
		type = 'button',
		role,
		tabindex,
		'aria-selected': selected,
		class: className,
		onclick = () => {},
		children,
		...restProps
	}: Props = $props();
</script>

<button
	use:coordinateUnderline={{ active, variant }}
	{...restProps}
	{type}
	{role}
	tabindex={tabindex ?? (role === 'tab' ? (active ? 0 : -1) : undefined)}
	aria-selected={selected ?? (role === 'tab' ? active : undefined)}
	class={['sy-tab', className]}
	class:sy-tab--active={active}
	class:sy-tab--mobile={variant === 'mobile'}
	{onclick}
>
	{@render children?.()}
</button>

<style>
	.sy-tab {
		background: none;
		border: none;
		border-bottom: 2px solid transparent;
		padding: var(--sy-space--large) var(--sy-space);
		margin-bottom: -1px;
		cursor: pointer;
		font-family: var(--sy-font-family);
		font-size: var(--sy-font-size--medium);
		font-weight: var(--sy-font-weight--normal);
		color: var(--sy-text--muted);
		min-width: 0;
		max-width: 100%;
		overflow-wrap: anywhere;
		transition:
			color var(--sy-transition-duration),
			border-color var(--sy-transition-duration);
	}
	.sy-tab:hover {
		color: var(--sy-color--black);
	}
	.sy-tab--active {
		color: var(--sy-color--black);
		border-bottom-color: var(--sy-text--blue);
		font-weight: var(--sy-font-weight--bold);
	}
	:global(.sy-tab--motion) .sy-tab--active {
		border-bottom-color: transparent;
	}
	:global(.sy-tab__indicator) {
		position: absolute;
		z-index: 1;
		background: var(--sy-text--blue);
		pointer-events: none;
	}
	.sy-tab--mobile {
		border-bottom: 0;
		margin-bottom: 0;
		padding: var(--sy-space) var(--sy-space--large);
		font-size: var(--sy-font-size--mobile-medium);
		color: var(--sy-text--dark);
	}
	.sy-tab--mobile.sy-tab--active {
		text-decoration: underline;
		text-underline-position: under;
		text-decoration-thickness: 1px;
		color: var(--sy-color--black);
		border-bottom-color: transparent;
	}
	:global(.sy-tab--motion) .sy-tab--mobile.sy-tab--active {
		text-decoration: none;
	}
</style>
