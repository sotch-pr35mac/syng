<script>
	import active from 'svelte-spa-router/active';
	import { 
		SearchIcon,
		BookOpenIcon,
		BookmarkIcon,
		TrendingUpIcon,
		MessageCircleIcon,
		MoreVerticalIcon,
		SettingsIcon,
		HelpCircleIcon	
	} from 'svelte-feather-icons';

	const ipcRenderer = window.require('electron').ipcRenderer;
	const primaryNavigation = [
		{
			link: '',
			icon: SearchIcon,
			title: 'Search'
		},
		{
			link: 'read',
			icon: BookOpenIcon,
			title: 'Read'
		},
		{
			link: 'bookmarks',
			icon: BookmarkIcon,
			title: 'Bookmarks'
		},
		{
			link: 'study',
			icon: TrendingUpIcon,
			title: 'Study'
		},
		{
			link: 'chat',
			icon: MessageCircleIcon,
			title: 'Chat'
		},
		{
			link: 'tools',
			icon: MoreVerticalIcon,
			title: 'Extras'
		}
	];
	const secondaryNavigation = [
		{
			link: 'help',
			icon: HelpCircleIcon,
			size: '18',
			title: 'Help'
		},
		{
			link: 'settings',
			icon: SettingsIcon,
			size: '24',
			title: 'Settings'
		}
	];

let trafficLightMargin = process.platform === 'darwin';

ipcRenderer.on('enter-full-screen', () => {
		trafficLightMargin = false;
});
ipcRenderer.on('leave-full-screen', () => {
		if (process.platform === 'darwin') {
			trafficLightMargin = true;
		}
});
</script>

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
}
.navigation--primary-nav {
	display: flex;
	flex-direction: column;
	align-items: center;
    margin-top: var(--sy-space);
}
.navigation--primary-nav--macos {
	margin-top: calc(35px + var(--sy-space));
}
.navigation--secondary-nav {
	display: flex;
	flex-direction: column;
	align-items: center;
}
.navigation--item {
	color: var(--sy-color--grey-4);
	margin: var(--sy-space);
	padding: var(--sy-space--large);
	height: 30px;
	width: 30px;
	display: flex;
	align-items: center;
	justify-content: center;
}
.navigation--item:hover {
	color: var(--sy-color--blue);
	transition-property: color;
	transition-duration: var(--sy-transition-duration);
}
:global(.navigation--item-active) {
	background-color: var(--sy-color--white);
	border-radius: 100%;
	box-shadow: var(--sy-shadow);
	color: var(--sy-color--grey-4) !important;
	transition-property: background-color, box-shadow, border-radius, color !important;
	transition-duration: var(--sy-transition-duration) !important;
}
:global(.navigation--item-active:hover) {
	box-shadow: var(--sy-shadow--active);
	border-radius: 100%;
}
</style>

<div class="navigation-container">
	<div class="navigation--primary-nav" class:navigation--primary-nav--macos={trafficLightMargin}>
	{#each primaryNavigation as navItem}
		<a href="{`#/${navItem.link}`}" class="sy-tooltip--container">
			<span class="navigation--item" use:active={{path: `/${navItem.link}`, className: 'navigation--item-active'}}>
				<svelte:component this={navItem.icon} size="24"/>
			</span>
			<div class="sy-tooltip--body sy-tooltip--body-right">
				<p>
					{ navItem.title }
				</p>
			</div>
		</a>
	{/each}
	</div>
	<div class="navigation--secondary-nav">
	{#each secondaryNavigation as navItem}
		<a href="{`#/${navItem.link}`}" class="sy-tooltip--container">
			<span class="navigation--item" use:active={{path: `/${navItem.link}`, className: 'navigation--item-active'}}>
				<svelte:component this={navItem.icon} size="{navItem.size}"/>
			</span>
			<div class="sy-tooltip--body sy-tooltip--body-right">
				<p>
					{ navItem.title }
				</p>
			</div>
		</a>
	{/each}
	</div>
</div>
