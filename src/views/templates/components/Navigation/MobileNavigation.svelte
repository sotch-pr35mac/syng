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
	<div class="mobile-nav__tabs">
		{#each tabs as tab (tab.href)}
			<a
				href={tab.href}
				class="mobile-nav__tab"
				aria-label={tab.label}
				title={tab.label}
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
		align-items: center;
		justify-content: center;
		padding: var(--sy-mobile-space--medium) var(--sy-mobile-space--large);
		padding-top: max(var(--sy-mobile-space--medium), env(safe-area-inset-top));
		background: var(--sy-color--white);
		border-bottom: var(--sy-border);
		flex-shrink: 0;
		z-index: var(--sy-z-index--mobile-nav);
	}

	.mobile-nav__tabs {
		display: grid;
		grid-template-columns: repeat(6, minmax(0, 1fr));
		align-items: center;
		box-sizing: border-box;
		width: min(100%, calc(var(--sy-mobile-touch-target) * 8));
		padding: var(--sy-mobile-space--extra-small);
		border: var(--sy-mobile-surface-border);
		border-radius: calc(var(--sy-border-radius) * 4);
		background-color: var(--sy-color--grey-2);
		box-shadow: var(--sy-inner-shadow);
	}

	.mobile-nav__tab {
		display: flex;
		align-items: center;
		justify-content: center;
		box-sizing: border-box;
		min-width: 0;
		min-height: var(--sy-mobile-touch-target);
		border-radius: calc(var(--sy-border-radius) * 3);
		font-family: var(--sy-font-family);
		color: var(--sy-color--grey-4);
		text-decoration: none;
		transition:
			background-color var(--sy-transition-duration),
			box-shadow var(--sy-transition-duration),
			color var(--sy-transition-duration);
	}

	.mobile-nav__tab:active {
		background-color: var(--sy-mobile-state-pressed);
	}

	@media (hover: hover) {
		.mobile-nav__tab:hover {
			color: var(--sy-color--blue);
		}
	}

	:global(.mobile-nav__tab.mobile-nav__tab--active) {
		background-color: var(--sy-color--white);
		box-shadow: var(--sy-shadow);
		color: var(--sy-color--blue);
	}

	:global(.mobile-nav__tab.mobile-nav__tab--active:active) {
		background-color: var(--sy-color--white);
	}
</style>
