<script lang="ts">
	import type { Snippet } from 'svelte';
	import { X } from 'lucide-svelte';
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import { isMobile } from '@/utils/device.js';
	import { portal } from '@/actions/portal.svelte.js';
	import { overlayFocus } from '@/actions/overlayFocus.js';

	const {
		visible = false,
		title = '',
		accessibleName = 'Dialog',
		dismissible = true,
		initialFocus = undefined,
		returnFocus = undefined,
		body,
		footer,
		onclose = () => {},
	}: {
		visible?: boolean;
		title?: string;
		accessibleName?: string;
		dismissible?: boolean;
		initialFocus?: HTMLElement | (() => HTMLElement | null | undefined);
		returnFocus?: HTMLElement | (() => HTMLElement | null | undefined);
		body?: Snippet;
		footer?: Snippet;
		onclose?: () => void;
	} = $props();
	const mobile = isMobile();
	const titleId = $props.id();
</script>

<div use:portal hidden={!visible} class="sy-modal--container" class:sy-modal--active={visible}>
	<div
		class="sy-modal--content"
		class:sy-modal--content--mobile={mobile}
		role="dialog"
		aria-modal="true"
		aria-labelledby={title ? titleId : undefined}
		aria-label={title ? undefined : accessibleName}
		tabindex="-1"
		use:overlayFocus={{
			active: visible,
			modal: true,
			initialFocus: 'always',
			initialFocusTarget: initialFocus,
			returnFocus,
			dismissible,
			onclose,
		}}
	>
		<div class="sy-modal--header">
			<h2
				id={titleId}
				class="sy-modal--title"
				tabindex="-1"
				data-sy-overlay-heading={title ? true : undefined}
			>
				{title}
			</h2>
			{#if dismissible}
				<SyButton style="ghost" aria-label="Close dialog" onclick={onclose}>
					<X size="14" aria-hidden="true" />
				</SyButton>
			{/if}
		</div>
		<div class="sy-modal--body">
			{@render body?.()}
		</div>
		<div class="sy-modal--footer">
			{@render footer?.()}
		</div>
	</div>
	<div class="sy-modal--backdrop"></div>
</div>

<style>
	.sy-modal--active {
		display: block !important;
	}
	.sy-modal--container {
		display: none;
		position: absolute;
		top: 25vh;
		left: 60vh;
		transition: all ease var(--sy-transition-duration);
	}
	.sy-modal--backdrop {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background-color: var(--sy-color--modal-overlay);
		z-index: var(--sy-z-index--top-2);
	}
	.sy-modal--content {
		box-sizing: border-box;
		max-width: calc(100vw - 2rem);
		max-height: calc(100vh - 2rem);
		overflow-y: auto;
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		background-color: var(--sy-color--white);
		box-shadow: var(--sy-shadow--active);
		border-radius: var(--sy-border-radius);
		padding: var(--sy-space--large);
		z-index: var(--sy-z-index--top-1);
	}
	.sy-modal--content--mobile {
		width: calc(100vw - (var(--sy-mobile-space--medium) * 6));
		max-width: 420px;
		box-shadow: var(--sy-mobile-overlay-shadow);
		border: var(--sy-mobile-surface-border);
	}
	.sy-modal--header {
		display: flex;
		flex-direction: row;
		align-items: center;
		justify-content: space-between;
	}
	.sy-modal--title {
		min-width: 0;
		overflow-wrap: anywhere;
		margin: var(--sy-space) 0px;
	}
	.sy-modal--body {
		padding: var(--sy-space);
	}
	.sy-modal--footer {
		flex-wrap: wrap;
		gap: var(--sy-space);
		display: flex;
		flex-direction: row;
		align-items: center;
		justify-content: flex-end;
	}
</style>
