<script>
	import { onMount } from 'svelte';
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

<nav class="navigation-container" aria-label="Primary navigation">
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
		background-color: var(--sy-color--grey-2);
		height: 100vh;
		width: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: space-between;
		box-shadow: inset 0px 0px 4px rgba(0, 0, 0, 0.1);
		overflow-y: auto;
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
		color: var(--sy-icon--muted);
		margin: var(--sy-space);
		padding: var(--sy-space--large);
		height: 30px;
		width: 30px;
		display: flex;
		align-items: center;
		justify-content: center;
		position: relative;
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
			transition-property: color;
			transition-duration: var(--sy-transition-duration);
		}
	}
	:global(.navigation--item-active) {
		background-color: var(--sy-color--white);
		border-radius: 100%;
		box-shadow: var(--sy-shadow);
		color: var(--sy-icon--muted) !important;
		transition-property: background-color, box-shadow, border-radius, color !important;
		transition-duration: var(--sy-transition-duration) !important;
	}
	:global(.navigation--item-active:hover) {
		box-shadow: var(--sy-shadow--active);
		border-radius: 100%;
	}
</style>
