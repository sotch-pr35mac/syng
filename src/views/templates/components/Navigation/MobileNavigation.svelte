<script lang="ts">
	import {
		Bookmark,
		BookOpen,
		EllipsisVertical,
		GraduationCap,
		Search,
		Settings,
	} from 'lucide-svelte';
	import active from 'svelte-spa-router/active';
	import { router } from 'svelte-spa-router';
	import { onMount, tick } from 'svelte';
	import { walkthroughTarget } from '@/actions/walkthroughTarget.svelte.js';
	const BRAND_HEIGHT = 63;
	const WORDMARK_SHRINK = 0.55;
	const WORDMARK_RENDER_HEIGHT = 30;
	const PILL_INSET = 1;
	const DIVIDER_COVER_TOLERANCE = 3;
	const SPRING_STIFFNESS = 330;
	const SPRING_DAMPING = 35;
	const SHAPE_STIFFNESS = 180;
	const SHAPE_DAMPING = 15;
	const SHAPE_LIMIT = 0.07;
	const SHAPE_HEIGHT_COMPENSATION = 0.65;
	const IMPACT_DISTANCE = 6;
	const IMPACT_IMPULSE = 0.85;
	const POSITION_EPSILON = 0.2;
	const VELOCITY_EPSILON = 0.8;
	const SHAPE_EPSILON = 0.002;
	const SHAPE_VELOCITY_EPSILON = 0.02;
	const MAX_FRAME_RATE = 30;
	const INITIAL_FRAME_RATE = 60;
	const MAX_FRAME_SECONDS = 1 / MAX_FRAME_RATE;
	const INITIAL_FRAME_SECONDS = 1 / INITIAL_FRAME_RATE;
	const { scrollProgress = 0 }: { scrollProgress?: number } = $props();
	const wordmarkScale = $derived(
		Math.max(
			0,
			Math.min(
				1 - WORDMARK_SHRINK * scrollProgress,
				(BRAND_HEIGHT * (1 - scrollProgress)) / WORDMARK_RENDER_HEIGHT
			)
		)
	);
	let track: HTMLDivElement;
	let indicator: HTMLDivElement;
	let position = 0;
	let velocity = 0;
	let target = 0;
	let shape = 0;
	let shapeVelocity = 0;
	let shapeKicked = false;
	let pointerSelection = false;
	let frame = 0;
	let lastTime = 0;
	const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
	function paint(): void {
		if (!indicator || !track) {
			return;
		}
		const boundedShape = Math.max(-SHAPE_LIMIT, Math.min(SHAPE_LIMIT, shape));
		indicator.style.transform = `translate3d(${position}px,0,0) scale(${1 + boundedShape}, ${1 - boundedShape * SHAPE_HEIGHT_COMPENSATION})`;
		const visibleLeft = position - (indicator.offsetWidth * boundedShape) / 2;
		const visibleRight = position + indicator.offsetWidth * (1 + boundedShape / 2);
		const dividerTrack = track.querySelector<HTMLElement>('.mobile-nav__dividers');
		const dividers = track.querySelectorAll<HTMLElement>('.mobile-nav__divider');
		dividers.forEach((divider) => {
			const dividerX =
				(dividerTrack?.offsetLeft ?? 0) + divider.offsetLeft + divider.offsetWidth;
			divider.classList.toggle(
				'mobile-nav__divider--covered',
				dividerX >= visibleLeft - DIVIDER_COVER_TOLERANCE &&
					dividerX <= visibleRight + DIVIDER_COVER_TOLERANCE
			);
		});
	}
	function selectedLink(): HTMLAnchorElement | null {
		return track?.querySelector<HTMLAnchorElement>('[aria-current="page"]') ?? null;
	}
	function measure(snap = false): void {
		const link = selectedLink();
		if (!link || !indicator) {
			return;
		}
		const nextTarget = link.offsetLeft + PILL_INSET;
		const moved = Math.abs(nextTarget - target) > POSITION_EPSILON;
		target = nextTarget;
		indicator.style.width = `${Math.max(0, link.offsetWidth - PILL_INSET * 2)}px`;
		if (snap || reducedMotion?.matches) {
			cancelAnimationFrame(frame);
			frame = 0;
			lastTime = 0;
			velocity = 0;
			shape = 0;
			shapeVelocity = 0;
			position = target;
			paint();
		} else if (moved) {
			shapeKicked = false;
			if (!frame) {
				frame = requestAnimationFrame(animate);
			}
		}
	}
	function animate(time: number): void {
		const delta = lastTime
			? Math.min((time - lastTime) / 1000, MAX_FRAME_SECONDS)
			: INITIAL_FRAME_SECONDS;
		lastTime = time;
		velocity += (SPRING_STIFFNESS * (target - position) - SPRING_DAMPING * velocity) * delta;
		position += velocity * delta;
		if (!shapeKicked && Math.abs(target - position) < IMPACT_DISTANCE) {
			shapeVelocity += Math.sign(velocity) * IMPACT_IMPULSE;
			shapeKicked = true;
		}
		shapeVelocity += (-SHAPE_STIFFNESS * shape - SHAPE_DAMPING * shapeVelocity) * delta;
		shape += shapeVelocity * delta;
		if (
			Math.abs(target - position) < POSITION_EPSILON &&
			Math.abs(velocity) < VELOCITY_EPSILON &&
			Math.abs(shape) < SHAPE_EPSILON &&
			Math.abs(shapeVelocity) < SHAPE_VELOCITY_EPSILON
		) {
			position = target;
			velocity = 0;
			shape = 0;
			shapeVelocity = 0;
			frame = 0;
			lastTime = 0;
		} else {
			frame = requestAnimationFrame(animate);
		}
		paint();
	}
	function handlePointerDown(event: PointerEvent): void {
		pointerSelection =
			event.currentTarget instanceof HTMLAnchorElement &&
			event.currentTarget.getAttribute('aria-current') === 'page';
	}
	function pulseSelected(): void {
		const shouldPulse = pointerSelection;
		pointerSelection = false;
		if (!shouldPulse || reducedMotion?.matches) {
			return;
		}
		shapeKicked = true;
		shapeVelocity += IMPACT_IMPULSE;
		if (!frame) {
			frame = requestAnimationFrame(animate);
		}
	}
	$effect(() => {
		void router.location;
		void tick().then(() => measure());
	});
	onMount(() => {
		const observer = new ResizeObserver(() => measure(true));
		observer.observe(track);
		measure(true);
		const snap = () => measure(true);
		reducedMotion?.addEventListener('change', snap);
		return () => {
			observer.disconnect();
			reducedMotion?.removeEventListener('change', snap);
			cancelAnimationFrame(frame);
		};
	});

	const tabs = [
		{ href: '#/', path: '/', label: 'Search', icon: Search },
		{ href: '#/read', path: /^\/read(\/.*)?/, label: 'Read', icon: BookOpen },
		{ href: '#/bookmarks', path: '/bookmarks', label: 'Bookmarks', icon: Bookmark },
		{ href: '#/study', path: /^\/study(\/.*)?/, label: 'Study', icon: GraduationCap },
		{ href: '#/tools', path: '/tools', label: 'Extras', icon: EllipsisVertical },
		{ href: '#/settings', path: '/settings', label: 'Settings', icon: Settings },
	];
</script>

<nav class="mobile-nav" aria-label="Primary navigation">
	<div
		class="mobile-nav__brand"
		style:height={`${BRAND_HEIGHT * (1 - scrollProgress)}px`}
		aria-hidden={scrollProgress >= 1}
	>
		<span style:transform={`translate(-50%, -50%) scale(${wordmarkScale})`}>Syng</span>
	</div>
	<div class="mobile-nav__tabs" bind:this={track}>
		<div class="mobile-nav__dividers" aria-hidden="true">
			{#each tabs as tab (tab.href)}<span class="mobile-nav__divider"></span>{/each}
		</div>
		<div class="mobile-nav__indicator" bind:this={indicator} aria-hidden="true"></div>
		{#each tabs as tab (tab.href)}
			<a
				use:walkthroughTarget={tab.href === '#/study' ? 'study-navigation' : undefined}
				href={tab.href}
				class="mobile-nav__tab"
				aria-label={tab.label}
				aria-current={(
					typeof tab.path === 'string'
						? router.location === tab.path
						: tab.path.test(router.location)
				)
					? 'page'
					: undefined}
				title={tab.label}
				onpointerdown={handlePointerDown}
				onpointercancel={() => (pointerSelection = false)}
				onkeydown={() => (pointerSelection = false)}
				onclick={pulseSelected}
				use:active={{ path: tab.path, className: 'mobile-nav__tab--active' }}
			>
				<tab.icon size="22" aria-hidden="true" />
			</a>
		{/each}
	</div>
</nav>

<style>
	.mobile-nav {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 0 12px 7px;
		padding-top: max(var(--sy-mobile-space--medium), env(safe-area-inset-top));
		background: var(--sy-surface--chrome);
		border-bottom: var(--sy-border);
		flex-shrink: 0;
		z-index: var(--sy-z-index--mobile-nav);
	}
	.mobile-nav__brand {
		position: relative;
		overflow: hidden;
		width: 100%;
		color: var(--sy-color--black);
		font-size: 24px;
		font-weight: 700;
		letter-spacing: -0.055em;
		flex: none;
	}
	.mobile-nav__brand span {
		position: absolute;
		top: 50%;
		left: 50%;
		white-space: nowrap;
		transform-origin: center;
	}

	.mobile-nav__tabs {
		position: relative;
		display: grid;
		grid-template-columns: repeat(6, minmax(0, 1fr));
		align-items: center;
		box-sizing: border-box;
		width: min(100%, calc(var(--sy-mobile-touch-target) * 8));
		grid-template-rows: 37px;
		height: 43px;
		gap: 2px;
		padding: 2px;
		border: var(--sy-mobile-surface-border);
		border-radius: 13px;
		background-color: var(--sy-surface--well);
		box-shadow: var(--sy-inner-shadow);
	}
	.mobile-nav__dividers {
		position: absolute;
		inset: 3px;
		display: grid;
		grid-template-columns: repeat(6, minmax(0, 1fr));
		gap: 2px;
		pointer-events: none;
	}
	.mobile-nav__divider {
		position: relative;
	}
	.mobile-nav__divider:not(:last-child)::after {
		content: '';
		position: absolute;
		right: -1.5px;
		top: 50%;
		width: 1px;
		height: 16px;
		transform: translateY(-50%);
		background: var(--sy-color--grey-4);
		opacity: 0.55;
	}
	:global(.mobile-nav__divider--covered)::after {
		opacity: 0 !important;
	}
	.mobile-nav__indicator {
		position: absolute;
		top: 3px;
		left: 0;
		z-index: 1;
		height: 35px;
		border-radius: 9px;
		background: var(--sy-navigation-selection-fill);
		box-shadow: var(--sy-shadow);
		pointer-events: none;
		will-change: transform;
	}

	.mobile-nav__tab {
		display: flex;
		align-items: center;
		justify-content: center;
		box-sizing: border-box;
		min-width: 0;
		position: relative;
		z-index: 2;
		min-height: var(--sy-mobile-touch-target);
		border-radius: 9px;
		font-family: var(--sy-font-family);
		color: var(--sy-icon--muted);
		text-decoration: none;
		transition: color var(--sy-transition-duration);
	}

	.mobile-nav__tab:active {
		background-color: var(--sy-mobile-state-pressed);
	}

	@media (hover: hover) {
		.mobile-nav__tab:hover {
			color: var(--sy-icon--hover);
		}
	}

	:global(.mobile-nav__tab.mobile-nav__tab--active) {
		background-color: transparent;
		box-shadow: none;
		color: var(--sy-icon--hover);
	}

	:global(.mobile-nav__tab.mobile-nav__tab--active:active) {
		background-color: transparent;
	}
	@media (prefers-reduced-motion: reduce) {
		.mobile-nav__brand span {
			transform: translate(-50%, -50%) !important;
		}
	}
</style>
