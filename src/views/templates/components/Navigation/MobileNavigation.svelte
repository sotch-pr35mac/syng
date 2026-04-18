<script lang="ts">
	import { Settings } from 'lucide-svelte';
	import active from 'svelte-spa-router/active';

	const tabs = [
		{ href: '#/', path: '/', label: 'Search' },
		{ href: '#/bookmarks', path: '/bookmarks', label: 'Bookmarks' },
		{ href: '#/study', path: /^\/study(\/.*)?/, label: 'Study' },
	];
</script>

<nav class="mobile-nav">
	<div class="mobile-nav__tabs">
		{#each tabs as tab (tab.href)}
			<a
				href={tab.href}
				class="mobile-nav__tab"
				use:active={{ path: tab.path, className: 'mobile-nav__tab--active' }}
			>
				{tab.label}
			</a>
		{/each}
	</div>
	<a
		href="#/settings"
		class="mobile-nav__settings"
		use:active={{ path: '/settings', className: 'mobile-nav__settings--active' }}
	>
		<Settings size="20" />
	</a>
</nav>

<style>
	.mobile-nav {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		padding: calc(var(--sy-mobile-space--small) * 3) var(--sy-mobile-space--large);
		padding-top: max(calc(var(--sy-mobile-space--small) * 3), env(safe-area-inset-top));
		background: var(--sy-color--white);
		border-bottom: var(--sy-border);
		flex-shrink: 0;
		z-index: var(--sy-z-index--mobile-nav);
	}

	.mobile-nav__tabs {
		grid-column: 2;
		display: flex;
		gap: var(--sy-space--extra-large);
		align-items: center;
	}

	.mobile-nav__tab {
		font-family: var(--sy-font-family);
		font-size: var(--sy-font-size--mobile-large);
		font-weight: 500;
		color: var(--sy-color--grey-4);
		text-decoration: none;
	}

	:global(.mobile-nav__tab.mobile-nav__tab--active) {
		color: var(--sy-color--blue);
		font-weight: 700;
	}

	.mobile-nav__settings {
		grid-column: 3;
		justify-self: end;
		color: var(--sy-color--grey-4);
		display: flex;
		align-items: center;
		text-decoration: none;
	}

	:global(.mobile-nav__settings.mobile-nav__settings--active) {
		color: var(--sy-color--blue);
	}
</style>
