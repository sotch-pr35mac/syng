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
		actionLabel?: string;
		corner?: Corner;
		onaction?: () => void;
		ondismiss?: () => void;
	}

	const {
		visible = false,
		message = '',
		actionLabel = '',
		corner = 'top-right',
		onaction = () => {},
		ondismiss = () => {},
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
	role="status"
	aria-live="polite"
>
	<div class="sy-toast--body">
		<span class="sy-toast--message">{message}</span>
		{#if actionLabel}
			<button class="sy-toast--action" onclick={onaction}>{actionLabel}</button>
		{/if}
	</div>
	<SyButton style="ghost" onclick={ondismiss}>
		<X size="14" />
	</SyButton>
</div>

<style>
	.sy-toast {
		position: fixed;
		z-index: var(--sy-z-index--top);
		display: flex;
		flex-direction: row;
		align-items: center;
		justify-content: space-between;
		gap: var(--sy-space--large);
		width: 280px;
		padding: var(--sy-space--large);
		background-color: var(--sy-color--white);
		border-radius: var(--sy-border-radius);
		box-shadow: var(--sy-shadow--active);
		opacity: 0;
		pointer-events: none;
		transition:
			transform var(--sy-transition-duration),
			opacity var(--sy-transition-duration);
	}
	.sy-toast--top-right {
		top: var(--sy-space--extra-large);
		right: var(--sy-space--extra-large);
		transform: translateY(calc(-100% - var(--sy-space--extra-large)));
	}
	.sy-toast--top-left {
		top: var(--sy-space--extra-large);
		left: var(--sy-space--extra-large);
		transform: translateY(calc(-100% - var(--sy-space--extra-large)));
	}
	.sy-toast--bottom-right {
		bottom: var(--sy-space--extra-large);
		right: var(--sy-space--extra-large);
		transform: translateY(calc(100% + var(--sy-space--extra-large)));
	}
	.sy-toast--bottom-left {
		bottom: var(--sy-space--extra-large);
		left: var(--sy-space--extra-large);
		transform: translateY(calc(100% + var(--sy-space--extra-large)));
	}
	.sy-toast--visible {
		transform: translateY(0);
		opacity: 1;
		pointer-events: auto;
	}
	.sy-toast--body {
		display: flex;
		flex-direction: column;
		gap: var(--sy-space);
		flex: 1;
	}
	.sy-toast--message {
		font-size: var(--sy-font-size--small);
		font-weight: var(--sy-font-weight--normal);
		color: var(--sy-color--black);
	}
	.sy-toast--action {
		background: none;
		border: none;
		padding: 0;
		font-family: var(--sy-font-family);
		font-size: var(--sy-font-size--small);
		font-weight: var(--sy-font-weight--normal);
		color: var(--sy-color--blue);
		cursor: pointer;
		text-align: left;
	}
	.sy-toast--action:focus {
		outline: none;
	}
	.sy-toast--action:hover {
		color: var(--sy-color--blue-2);
		transition-property: color;
		transition-duration: var(--sy-transition-duration);
	}
</style>
