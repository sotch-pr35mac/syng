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

	const primaryNavigation = [
		{
			link: '',
			icon: SearchIcon
		},
		{
			link: 'read',
			icon: BookOpenIcon
		},
		{
			link: 'bookmarks',
			icon: BookmarkIcon
		},
		{
			link: 'study',
			icon: TrendingUpIcon
		},
		{
			link: 'chat',
			icon: MessageCircleIcon
		},
		{
			link: 'tools',
			icon: MoreVerticalIcon
		}
	];
	const secondaryNavigation = [
		{
			link: 'help',
			icon: HelpCircleIcon,
			size: '18'
		},
		{
			link: 'settings',
			icon: SettingsIcon,
			size: '24'
		}
	];
</script>

<style>
.navigation-container {
	background-color: var(--sy-color--grey-1);
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
}
.navigation--secondary-nav {
	display: flex;
	flex-direction: column;
	align-items: center;
}
.navigation--item {
	color: var(--sy-color--grey-2);
	margin: 5px;
	padding: 10px;
	height: 30px;
	width: 30px;
	display: flex;
	align-items: center;
	justify-content: center;
}
.navigation--item:hover {
	color: #76AFF9;
	transition-property: color;
	transition-duration: 0.25s;
}
:global(.navigation--item-active) {
	background-color: var(--sy-color--white);
	border-radius: 100%;
	box-shadow: 0px 1px 4px rgba(0, 0, 0, 0.25);
	color: var(--sy-color--grey-2) !important;
	transition-property: background-color, box-shadow, border-radius, color !important;
	transition-duration: 0.25s !important;
}
:global(.navigation--item-active:hover) {
	box-shadow: 0px 0px 10px rgba(0, 0, 0, 0.10);
	border-radius: 100%;
}
</style>

<div class="navigation-container">
	<div class="navigation--primary-nav">
	{#each primaryNavigation as navItem}
		<a href="{`#/${navItem.link}`}">
			<span class="navigation--item" use:active={{path: `/${navItem.link}`, className: 'navigation--item-active'}}>
				<svelte:component this={navItem.icon} size="24"/>
			</span>
		</a>
	{/each}
	</div>
	<div class="navigation--secondary-nav">
	{#each secondaryNavigation as navItem}
		<a href="{`#/${navItem.link}`}">
			<span class="navigation--item" use:active={{path: `/${navItem.link}`, className: 'navigation--item-active'}}>
				<svelte:component this={navItem.icon} size="{navItem.size}"/>
			</span>
		</a>
	{/each}
	</div>
</div>
