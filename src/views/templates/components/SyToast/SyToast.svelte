<script lang="ts">
	import { X } from 'lucide-svelte';
	import SyButton from '@/components/SyButton/SyButton.svelte';

	/* Visible Prop */

	/* Message Prop */

	/* ActionLabel Prop */
	/* Possible Values */
	// If omitted, no action link is rendered

	/* Corner Prop */
	/* Possible Values */
	// 'top-right' - Top right corner (default)
	// 'top-left' - Top left corner
	// 'bottom-right' - Bottom right corner
	// 'bottom-left' - Bottom left corner

	type Corner = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';

	interface Props {
		visible?: boolean;
		message?: string;
		detail?: string;
		actionLabel?: string;
		corner?: Corner;
		onaction?: () => void;
		ondismiss?: () => void;
		bottomOffset?: string;
	}

	const {
		visible = false,
		message = '',
		detail = '',
		actionLabel = '',
		corner = 'top-right',
		onaction = () => {},
		ondismiss = () => {},
		bottomOffset = '',
	}: Props = $props();

	const DISMISS_TIMEOUT_MS = 8000;

	$effect(() => {
		if (!visible) {
			return undefined;
		}
		const timer = setTimeout(() => ondismiss(), DISMISS_TIMEOUT_MS);
		return () => clearTimeout(timer);
	});
</script>

<div
	class="sy-toast sy-toast--{corner}"
	class:sy-toast--visible={visible}
	style:--sy-toast-bottom-offset={bottomOffset}
	role="status"
	aria-live="polite"
	aria-hidden={!visible}
	inert={!visible}
>
	<div class="sy-toast--body">
		<span class="sy-toast--message">{message}</span>
		{#if detail}<span class="sy-toast--detail">{detail}</span>{/if}
	</div>
	{#if actionLabel}
		<button class="sy-toast--action" onclick={onaction}>{actionLabel}</button>
	{/if}
	<SyButton
		style="ghost"
		shape="circle"
		size="small"
		class="sy-toast--close"
		onclick={ondismiss}
		aria-label="Dismiss notification"
		tabindex={visible ? 0 : -1}
	>
		<X size="14" aria-hidden="true" />
	</SyButton>
</div>

<style>
	.sy-toast {
		--sy-toast-start-x: 5px;
		--sy-toast-start-y: -7px;
		position: fixed;
		z-index: var(--sy-z-index--top);
		display: flex;
		flex-direction: row;
		align-items: flex-start;
		justify-content: space-between;
		gap: 14px;
		box-sizing: border-box;
		width: 355px;
		max-width: calc(100vw - 36px);
		visibility: hidden;
		padding: 13px 14px;
		background-color: var(--sy-surface--floating);
		border: var(--sy-surface-border);
		border-radius: var(--sy-border-radius--floating);
		box-shadow: var(--sy-shadow--raised);
		opacity: 0;
		pointer-events: none;
		transform: translate(var(--sy-toast-start-x), var(--sy-toast-start-y)) scale(0.94, 0.88);
		transition:
			transform var(--sy-motion--overlay-fast) var(--sy-ease--overlay),
			opacity var(--sy-motion--overlay-fast) var(--sy-ease--overlay),
			visibility 0s linear var(--sy-motion--overlay-fast);
	}
	.sy-toast--top-right {
		top: var(--sy-space--extra-large);
		right: var(--sy-space--extra-large);
		transform-origin: right top;
	}
	.sy-toast--top-left {
		--sy-toast-start-x: -5px;
		top: var(--sy-space--extra-large);
		left: var(--sy-space--extra-large);
		transform-origin: left top;
	}
	.sy-toast--bottom-right {
		--sy-toast-start-y: 7px;
		bottom: calc(var(--sy-space--extra-large) + var(--sy-toast-bottom-offset, 0px));
		right: var(--sy-space--extra-large);
		transform-origin: right bottom;
	}
	.sy-toast--bottom-left {
		--sy-toast-start-x: -5px;
		--sy-toast-start-y: 7px;
		bottom: calc(var(--sy-space--extra-large) + var(--sy-toast-bottom-offset, 0px));
		left: var(--sy-space--extra-large);
		transform-origin: left bottom;
	}
	.sy-toast--visible {
		visibility: visible;
		transform: translate(0, 0) scale(1);
		opacity: 1;
		pointer-events: auto;
		transition:
			transform var(--sy-motion--overlay-fast) var(--sy-ease--overlay),
			opacity var(--sy-motion--overlay-fast) var(--sy-ease--overlay),
			visibility 0s;
	}
	.sy-toast--body {
		display: flex;
		flex-direction: column;
		gap: var(--sy-space);
		flex: 1;
	}
	.sy-toast--message {
		font-size: var(--sy-font-size--small);
		font-weight: var(--sy-font-weight--bold);
		color: var(--sy-color--black);
	}
	.sy-toast--detail {
		color: var(--sy-text--secondary);
		font-size: var(--sy-font-size--small);
	}
	.sy-toast--action {
		align-self: center;
		background: none;
		border: none;
		padding: 0;
		font-family: var(--sy-font-family);
		font-size: var(--sy-font-size--small);
		font-weight: var(--sy-font-weight--normal);
		color: var(--sy-text--blue);
		cursor: pointer;
		text-align: left;
	}
	.sy-toast--action:hover {
		color: var(--sy-text--blue);
		transition-property: color;
		transition-duration: var(--sy-transition-duration);
	}
	.sy-toast :global(.sy-toast--close) {
		flex: none;
		margin: 0;
	}
	@media (prefers-reduced-motion: reduce) {
		.sy-toast,
		.sy-toast--visible {
			transform: none;
			transition:
				opacity 100ms ease-out,
				visibility 0s linear 100ms;
		}
		.sy-toast--visible {
			transition:
				opacity 100ms ease-out,
				visibility 0s;
		}
	}
</style>
