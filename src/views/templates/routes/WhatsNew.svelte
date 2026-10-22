<script lang="ts">
	import { onMount, tick } from 'svelte';
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import Awa from '@/components/Awa/Awa.svelte';
	import { whatsNewStore } from '@/stores/whatsNew.svelte.js';
	import { isMobileLayout, isMobile } from '@/utils/device.js';

	const MASCOT_SIZE = 96;
	let content = $state<HTMLDivElement>();
	let heading = $state<HTMLHeadingElement>();
	const notes = whatsNewStore
		.preparePage()
		.then(() => import('@/components/WhatsNew/WhatsNewContent.svelte'));
	let lastPosition = whatsNewStore.position;
	let restoring = true;
	onMount(() => {
		heading?.focus({ preventScroll: true });
		return () => {
			whatsNewStore.position = lastPosition;
		};
	});
	async function restore(): Promise<void> {
		await tick();
		if (content) {
			content.scrollTop = lastPosition;
		}
		restoring = false;
	}
</script>

<div
	class="whats-new"
	class:whats-new--mobile={isMobileLayout()}
	class:whats-new--desktop={!isMobile()}
	data-tauri-drag-region={!isMobile() ? true : undefined}
>
	{#if !isMobile()}
		<div class="whats-new__titlebar" data-tauri-drag-region aria-hidden="true"></div>
	{/if}
	<div class="whats-new__card">
		<div
			class="whats-new__scroll"
			bind:this={content}
			onscroll={() => {
				if (!restoring && content) {
					lastPosition = content.scrollTop;
				}
			}}
		>
			<header>
				<Awa pose="wave" size={MASCOT_SIZE} />
				<h1 bind:this={heading} tabindex="-1">
					What’s New in Syng{whatsNewStore.range ? ` ${whatsNewStore.range.to}` : ''}
				</h1>
			</header>
			{#await notes}
				<p role="status">Opening release notes…</p>
			{:then module}
				<module.default onready={restore} />
			{:catch}
				<p role="alert">
					Release notes couldn’t load. You can continue using Syng and try again from
					Settings.
				</p>
			{/await}
		</div>
		<footer>
			<SyButton size="large" color="blue" onclick={whatsNewStore.continue}>Continue</SyButton>
		</footer>
	</div>
</div>

<style>
	.whats-new {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		min-width: 0;
		min-height: 0;
		box-sizing: border-box;
		padding: max(var(--sy-space--extra-large), env(safe-area-inset-top, 0px))
			max(var(--sy-space--extra-large), env(safe-area-inset-right, 0px))
			max(var(--sy-space--extra-large), env(safe-area-inset-bottom, 0px))
			max(var(--sy-space--extra-large), env(safe-area-inset-left, 0px));
		background: var(--sy-color--grey-2);
		color: var(--sy-text--dark);
		overflow-wrap: anywhere;
		line-height: var(--sy-line-height--body);
	}
	.whats-new--desktop {
		padding-top: 40px;
	}
	.whats-new__titlebar {
		position: fixed;
		inset: 0 0 auto;
		height: 32px;
	}
	.whats-new__card {
		display: flex;
		flex-direction: column;
		width: min(40rem, 100%);
		max-height: 100%;
		min-height: 0;
		background: var(--sy-color--white);
		border-radius: var(--sy-border-radius);
		box-shadow: var(--sy-box-shadow);
		overflow: hidden;
	}
	header {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--sy-space--large);
		margin-bottom: var(--sy-space--extra-large);
		text-align: center;
	}
	h1 {
		margin: 0;
		font-size: var(--sy-font-size--heading);
		font-weight: var(--sy-font-weight--bold);
	}
	.whats-new__scroll {
		flex: 0 1 auto;
		min-height: 0;
		overflow-y: auto;
		padding: var(--sy-space--extra-large);
		font-size: var(--sy-font-size--medium);
	}
	footer {
		display: flex;
		justify-content: flex-end;
		flex-shrink: 0;
		padding: var(--sy-space--large) var(--sy-space--extra-large);
		border-top: var(--sy-border);
	}
	footer :global(button) {
		margin: 0;
		min-height: var(--sy-mobile-touch-target);
	}
	.whats-new--mobile {
		padding: 0;
		background: var(--sy-color--white);
	}
	.whats-new--mobile .whats-new__card {
		width: 100%;
		height: 100%;
		border-radius: 0;
		box-shadow: none;
	}
	.whats-new--mobile .whats-new__scroll {
		flex: 1;
		padding: max(var(--sy-mobile-space--large), env(safe-area-inset-top, 0px))
			max(var(--sy-mobile-space--large), env(safe-area-inset-right, 0px))
			var(--sy-mobile-space--large)
			max(var(--sy-mobile-space--large), env(safe-area-inset-left, 0px));
		font-size: var(--sy-font-size--mobile-medium);
	}
	.whats-new--mobile h1 {
		font-size: var(--sy-font-size--mobile-heading);
	}
	.whats-new--mobile footer {
		padding: var(--sy-mobile-space--large)
			max(var(--sy-mobile-space--large), env(safe-area-inset-right, 0px))
			max(var(--sy-mobile-space--large), env(safe-area-inset-bottom, 0px))
			max(var(--sy-mobile-space--large), env(safe-area-inset-left, 0px));
		box-shadow: var(--sy-mobile-dock-shadow);
	}
</style>
