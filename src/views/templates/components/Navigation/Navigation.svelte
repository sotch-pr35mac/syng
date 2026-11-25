<script>
	import { onMount, tick } from 'svelte';
	import {
		Bookmark,
		BookOpen,
		CircleQuestionMark,
		EllipsisVertical,
		Search,
		Settings,
		GraduationCap,
	} from 'lucide-svelte';
	import active from 'svelte-spa-router/active';
	import { router } from 'svelte-spa-router';
	import { handleError } from '@/utils';
	import { platform } from '@tauri-apps/plugin-os';
	import { isIPad } from '@/utils/device.js';
	import { getCurrentWindow } from '@tauri-apps/api/window';
	import { getPreferenceManager } from '@/utils/appServices.js';
	import { updateStore } from '@/stores/update.svelte.js';
	import { walkthroughTarget } from '@/actions/walkthroughTarget.svelte.js';

	const primaryNavigation = [
		{
			link: '',
			icon: Search,
			title: 'Search',
			beta: false,
		},
		{
			link: 'read',
			pattern: /\/read(\/.*)?/,
			icon: BookOpen,
			title: 'Read',
			beta: false,
		},
		{
			link: 'bookmarks',
			icon: Bookmark,
			title: 'Bookmarks',
			beta: false,
		},
		{
			link: 'study',
			pattern: /\/study(\/.*)?/,
			icon: GraduationCap,
			title: 'Study',
			beta: false,
		},
		{
			link: 'tools',
			icon: EllipsisVertical,
			title: 'Extras',
			beta: false,
		},
	];
	const secondaryNavigation = [
		{
			link: 'help',
			icon: CircleQuestionMark,
			size: '18',
			title: 'Help',
			beta: true,
		},
		{
			link: 'settings',
			icon: Settings,
			size: '24',
			title: 'Settings',
			beta: false,
		},
	];

	const isMacos = platform() === 'macos';
	const isIPadDevice = isIPad();
	let enableBetaFeatures = $state(false);
	let trafficLightInset = $state(isMacos || isIPadDevice);
	let navigationElement;
	let selectionPill;
	let pillPosition = 0;
	let pillVelocity = 0;
	let pillTarget = 0;
	let pillFrame = 0;
	let pillTime = 0;
	let travelOrigin = 0;
	let travelDistance = 0;
	let travelDirection = 1;
	const PILL_RADIUS_PERCENT = 50;
	const TAPER_PERCENT = 11;
	const TRAVEL_WIDTH_CONTRACTION = 0.3;
	const TRAVEL_HEIGHT_CONTRACTION = 0.16;
	const SPRING_STIFFNESS = 330;
	const SPRING_DAMPING = 35;
	const POSITION_EPSILON = 0.2;
	const VELOCITY_EPSILON = 0.8;
	const MAX_FRAME_RATE = 30;
	const INITIAL_FRAME_RATE = 60;
	const MAX_FRAME_SECONDS = 1 / MAX_FRAME_RATE;
	const INITIAL_FRAME_SECONDS = 1 / INITIAL_FRAME_RATE;
	const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
	function paintPill() {
		if (!selectionPill) {
			return;
		}
		const progress = travelDistance
			? Math.min(1, Math.abs(pillPosition - travelOrigin) / travelDistance)
			: 0;
		const morph = Math.sin(Math.PI * progress);
		const leadingRadius = PILL_RADIUS_PERCENT + TAPER_PERCENT * morph * travelDirection;
		const trailingRadius = PILL_RADIUS_PERCENT - TAPER_PERCENT * morph * travelDirection;
		selectionPill.style.transform = `translate3d(0,${pillPosition}px,0) scale(${1 - TRAVEL_WIDTH_CONTRACTION * morph},${1 - TRAVEL_HEIGHT_CONTRACTION * morph})`;
		selectionPill.style.borderRadius = `${leadingRadius}% ${leadingRadius}% ${trailingRadius}% ${trailingRadius}%`;
	}
	function animatePill(time) {
		const delta = pillTime
			? Math.min((time - pillTime) / 1000, MAX_FRAME_SECONDS)
			: INITIAL_FRAME_SECONDS;
		pillTime = time;
		pillVelocity +=
			(SPRING_STIFFNESS * (pillTarget - pillPosition) - SPRING_DAMPING * pillVelocity) *
			delta;
		pillPosition += pillVelocity * delta;
		if (
			Math.abs(pillTarget - pillPosition) < POSITION_EPSILON &&
			Math.abs(pillVelocity) < VELOCITY_EPSILON
		) {
			pillPosition = pillTarget;
			pillVelocity = 0;
			pillFrame = 0;
			pillTime = 0;
			travelDistance = 0;
		} else {
			pillFrame = requestAnimationFrame(animatePill);
		}
		paintPill();
	}
	function measurePill(snap = false) {
		const selected = navigationElement?.querySelector(
			'[aria-current="page"] .navigation--item'
		);
		if (!selected || !selectionPill) {
			return;
		}
		const parent = navigationElement.getBoundingClientRect();
		const bounds = selected.getBoundingClientRect();
		selectionPill.style.left = `${bounds.left - parent.left}px`;
		selectionPill.style.width = `${bounds.width}px`;
		selectionPill.style.height = `${bounds.height}px`;
		const nextTarget = bounds.top - parent.top + navigationElement.scrollTop;
		const targetChanged = Math.abs(nextTarget - pillTarget) > POSITION_EPSILON;
		pillTarget = nextTarget;
		if (snap || reducedMotion?.matches) {
			cancelAnimationFrame(pillFrame);
			pillFrame = 0;
			pillVelocity = 0;
			pillPosition = pillTarget;
			travelDistance = 0;
			paintPill();
		} else if (targetChanged) {
			travelOrigin = pillPosition;
			travelDistance = Math.abs(pillTarget - travelOrigin);
			travelDirection = Math.sign(pillTarget - travelOrigin) || 1;
			if (!pillFrame) {
				pillFrame = requestAnimationFrame(animatePill);
			}
		}
	}
	$effect(() => {
		void router.location;
		void tick().then(() => measurePill());
	});
	onMount(() => {
		const observer = new ResizeObserver(() => measurePill(true));
		observer.observe(navigationElement);
		measurePill(true);
		const snap = () => measurePill(true);
		reducedMotion?.addEventListener('change', snap);
		return () => {
			observer.disconnect();
			reducedMotion?.removeEventListener('change', snap);
			cancelAnimationFrame(pillFrame);
		};
	});
	const updateAvailable = $derived(updateStore.updateAvailable);

	// On macOS, listen for fullscreen to adjust navigation when traffic lights disappear.
	onMount(() => {
		let unlisten;

		if (isMacos) {
			getCurrentWindow()
				.onResized(async () => {
					const fullscreen = await getCurrentWindow().isFullscreen();
					trafficLightInset = !fullscreen;
				})
				.then((unlistenFn) => {
					unlisten = unlistenFn;
					return undefined;
				})
				.catch((err) => {
					handleError('Error setting up fullscreen listener.', err, { silent: true });
				});
		}

		return () => {
			if (unlisten) {
				unlisten();
			}
		};
	});

	getPreferenceManager()
		.waitForInit()
		.then(() => {
			enableBetaFeatures = getPreferenceManager().get('beta');
			return undefined;
		})
		.catch((err) => {
			handleError(
				'There was an unexpected error reading system information. Syng may not operate as expected. Please restart Syng. If this problem persists, please report this bug. For more details check the logs.',
				err
			);
		});
</script>

<nav class="navigation-container" aria-label="Primary navigation" bind:this={navigationElement}>
	<span class="navigation--selection-pill" bind:this={selectionPill} aria-hidden="true"></span>
	<div
		class="navigation--primary-nav"
		class:navigation--primary-nav--traffic-light-inset={trafficLightInset}
	>
		{#each primaryNavigation as navItem (navItem.link)}
			{#if !navItem.beta || enableBetaFeatures}
				<a
					use:walkthroughTarget={navItem.link === 'study'
						? 'study-navigation'
						: undefined}
					href={`#/${navItem.link}`}
					class="sy-tooltip--container"
					data-sy-fixed-tooltip
					aria-label={navItem.title}
					aria-current={(
						navItem.pattern
							? navItem.pattern.test(router.location)
							: router.location === `/${navItem.link}`
					)
						? 'page'
						: undefined}
				>
					<span
						class="navigation--item"
						use:active={{
							path: navItem.pattern || `/${navItem.link}`,
							className: 'navigation--item-active',
						}}
					>
						<navItem.icon size="24" aria-hidden="true" />
					</span>
					<span class="sy-tooltip--body sy-tooltip--body-right" aria-hidden="true">
						{navItem.title}
					</span>
				</a>
			{/if}
		{/each}
	</div>
	<div class="navigation--secondary-nav">
		{#each secondaryNavigation as navItem (navItem.link)}
			{#if !navItem.beta || enableBetaFeatures}
				<a
					href={`#/${navItem.link}`}
					class="sy-tooltip--container"
					data-sy-fixed-tooltip
					aria-label={navItem.link === 'settings' && updateAvailable
						? `${navItem.title}, update available`
						: navItem.title}
					aria-current={router.location === `/${navItem.link}` ? 'page' : undefined}
				>
					<span
						class="navigation--item"
						use:active={{
							path: `/${navItem.link}`,
							className: 'navigation--item-active',
						}}
					>
						<navItem.icon size={navItem.size} aria-hidden="true" />
						{#if navItem.link === 'settings' && updateAvailable}
							<span class="navigation--badge" aria-hidden="true"></span>
							<span class="sy-sr-only">Update available</span>
						{/if}
					</span>
					<span class="sy-tooltip--body sy-tooltip--body-right" aria-hidden="true">
						{navItem.title}
					</span>
				</a>
			{/if}
		{/each}
	</div>
</nav>

<style>
	.navigation-container {
		position: relative;
		background-color: var(--sy-surface--chrome);
		height: 100vh;
		width: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: space-between;
		box-shadow: inset 0px 0px 4px rgba(0, 0, 0, 0.1);
		overflow-y: auto;
	}
	.navigation--selection-pill {
		position: absolute;
		z-index: 0;
		top: 0;
		left: 0;
		background: var(--sy-navigation-selection-fill);
		box-shadow: var(--sy-shadow);
		pointer-events: none;
		transition: box-shadow var(--sy-transition-duration);
		will-change: transform;
	}
	.navigation-container:has([aria-current='page']:hover) .navigation--selection-pill {
		box-shadow: var(--sy-shadow--active);
	}
	.navigation--primary-nav {
		display: flex;
		flex-direction: column;
		align-items: center;
		margin-top: var(--sy-space);
	}
	.navigation--primary-nav--traffic-light-inset {
		margin-top: calc(35px + var(--sy-space--large));
	}
	.navigation--secondary-nav {
		display: flex;
		flex-direction: column;
		align-items: center;
	}
	.navigation--item {
		z-index: 1;
		color: var(--sy-icon--muted);
		margin: var(--sy-space);
		padding: var(--sy-space--large);
		height: 30px;
		width: 30px;
		display: flex;
		align-items: center;
		justify-content: center;
		position: relative;
		transition: color var(--sy-transition-duration--control);
	}
	.navigation--badge {
		position: absolute;
		top: 4px;
		right: 4px;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background-color: var(--sy-icon--hover);
		pointer-events: none;
	}
	@media (hover: hover) {
		.navigation--item:hover {
			color: var(--sy-icon--hover);
		}
	}
	:global(.navigation--item-active) {
		background-color: transparent;
		border-radius: 100%;
		box-shadow: none;
		color: var(--sy-icon--muted) !important;
		transition-property: background-color, box-shadow, border-radius, color !important;
		transition-duration: var(--sy-transition-duration--control) !important;
	}
	:global(.navigation--item-active:hover) {
		box-shadow: none;
		border-radius: 100%;
	}
	.navigation--item:active {
		transition: none !important;
	}
</style>
