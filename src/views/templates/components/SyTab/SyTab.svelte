<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		active?: boolean;
		variant?: 'default' | 'mobile';
		onclick?: () => void;
		children?: Snippet;
	}

	const { active = false, variant = 'default', onclick = () => {}, children }: Props = $props();
</script>

<button
	class="sy-tab"
	class:sy-tab--active={active}
	class:sy-tab--mobile={variant === 'mobile'}
	{onclick}
>
	{@render children?.()}
</button>

<style>
	.sy-tab {
		background: none;
		border: none;
		border-bottom: 2px solid transparent;
		padding: var(--sy-space--large) var(--sy-space);
		margin-bottom: -1px;
		cursor: pointer;
		font-family: var(--sy-font-family);
		font-size: var(--sy-font-size--medium);
		font-weight: var(--sy-font-weight--normal);
		color: var(--sy-color--grey-3);
		transition:
			color var(--sy-transition-duration),
			border-color var(--sy-transition-duration);
	}
	.sy-tab:hover {
		color: var(--sy-color--black);
	}
	.sy-tab--active {
		color: var(--sy-color--black);
		border-bottom-color: var(--sy-color--blue);
		font-weight: var(--sy-font-weight--bold);
	}
	.sy-tab--mobile {
		border-bottom: 0;
		margin-bottom: 0;
		padding: var(--sy-space) var(--sy-space--large);
		font-size: var(--sy-font-size--mobile-medium);
		color: var(--sy-text--dark);
	}
	.sy-tab--mobile.sy-tab--active {
		text-decoration: underline;
		text-underline-position: under;
		text-decoration-thickness: 1px;
		color: var(--sy-color--black);
		border-bottom-color: transparent;
	}
</style>
