<script lang="ts">
	import type { Snippet } from 'svelte';
	import { X } from 'lucide-svelte';
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import { isMobile } from '@/utils/device.js';
	import { portal } from '@/actions/portal.svelte.js';
	import { overlayFocus } from '@/actions/overlayFocus.js';

	/* Visible Prop */

	/* Title Prop */

	/**
	 * @typedef {Object} Props
	 * @property {boolean} [visible] - Whether or not the modal is visible
	 * @property {string} [title] - The text to display in the modal header
	 * @property {string} [accessibleName] - Dialog name when no visible title is supplied
	 * @property {boolean} [dismissible] - Whether Escape, the backdrop, and the close button can dismiss it
	 * @property {HTMLElement | (() => HTMLElement | null | undefined)} [initialFocus] - Initial focus target
	 * @property {HTMLElement | (() => HTMLElement | null | undefined)} [returnFocus] - Focus target after closing
	 * @property {import('svelte').Snippet} [body]
	 * @property {import('svelte').Snippet} [footer]
	 * @property {() => void} [onclose] - Close handler
	 */
	/** @type {Props} */
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

<div
	use:portal
	class="sy-modal--container"
	class:sy-modal--active={visible}
	aria-hidden={!visible}
	inert={!visible}
>
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
	.sy-modal--container {
		position: fixed;
		inset: 0;
		z-index: var(--sy-z-index--top-1);
		visibility: hidden;
		pointer-events: none;
		transition: visibility 0s linear var(--sy-motion--overlay-regular);
	}
	.sy-modal--container.sy-modal--active {
		visibility: visible;
		pointer-events: auto;
		transition: visibility 0s;
	}
	.sy-modal--backdrop {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background-color: var(--sy-color--modal-overlay);
		z-index: var(--sy-z-index--top-2);
		opacity: 0;
		transition: opacity var(--sy-motion--overlay-regular) var(--sy-ease--overlay);
	}
	.sy-modal--active .sy-modal--backdrop {
		opacity: var(--sy-overlay-backdrop-opacity);
	}
	.sy-modal--content {
		box-sizing: border-box;
		max-width: calc(100vw - 2rem);
		max-height: calc(100vh - 2rem);
		overflow-y: auto;
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, calc(-50% + 8px)) scale(0.96);
		background-color: var(--sy-surface--floating);
		border: var(--sy-surface-border);
		box-shadow: var(--sy-shadow--dialog);
		border-radius: var(--sy-border-radius--modal);
		padding: var(--sy-modal-padding);
		z-index: var(--sy-z-index--top-1);
		opacity: 0;
		transition:
			transform var(--sy-motion--overlay-regular) var(--sy-ease--overlay),
			opacity var(--sy-motion--overlay-fast) var(--sy-ease--overlay);
	}
	.sy-modal--active .sy-modal--content {
		transform: translate(-50%, -50%) scale(1);
		opacity: 1;
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
	@media (prefers-reduced-motion: reduce) {
		.sy-modal--container,
		.sy-modal--backdrop,
		.sy-modal--content {
			transition: none;
		}
		.sy-modal--content,
		.sy-modal--active .sy-modal--content {
			transform: translate(-50%, -50%);
		}
	}
</style>
